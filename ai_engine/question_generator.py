#!/usr/bin/env python3
import json
import os
import random
import re
import sys
from typing import Dict, List, Optional

try:
    from transformers import AutoTokenizer
except Exception as exc:
    print(f"Transformers import failed: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    from huggingface_hub import InferenceClient
except Exception as exc:
    print(f"huggingface_hub import failed: {exc}", file=sys.stderr)
    sys.exit(1)


PRIMARY_MODEL = os.getenv("TRANSFORMERS_MODEL") or os.getenv("THAI_GENERATOR_MODEL") or "Qwen/Qwen2.5-1.5B-Instruct"
FALLBACK_MODELS = [
    PRIMARY_MODEL,
    "Qwen/Qwen2.5-1.5B-Instruct",
    "HuggingFaceTB/SmolLM2-1.7B-Instruct",
]
API_KEY = os.getenv("HUGGINGFACE_API_KEY", "").strip()
MAX_NEW_TOKENS = int(os.getenv("TRANSFORMERS_MAX_NEW_TOKENS", "1400"))
TEMPERATURE = float(os.getenv("TRANSFORMERS_TEMPERATURE", "0.9"))
TOP_P = float(os.getenv("TRANSFORMERS_TOP_P", "0.9"))
TOKENIZER_CACHE: Dict[str, Optional[object]] = {}
CLIENT = InferenceClient(api_key=API_KEY or None, provider=os.getenv("HF_INFERENCE_PROVIDER") or "auto")


PROFILE_ALIASES: Dict[str, List[str]] = {
    "analytical": ["percentage", "ratio", "proportion", "equation", "speed", "sequence", "table", "graph", "chart", "data", "reasoning"],
    "thai": ["reading", "article", "summarize", "interpretation", "word", "sentence", "synonym", "antonym", "ราชาศัพท์"],
    "english": ["tense", "preposition", "conjunction", "article", "vocabulary", "passage", "story"],
    "law": ["พ.ร.บ.", "พ.ร.ฎ.", "ป.อ.", "จริยธรรม", "เจ้าหน้าที่", "ราชการทางปกครอง"],
}

THAI_DISTRACTORS = [
    "ข้อความที่ไม่สอดคล้องกับเงื่อนไขของโจทย์",
    "แนวทางที่ขัดกับสาระสำคัญของหัวข้อนี้",
    "คำตอบที่กว้างเกินไปจนไม่ตรงประเด็น",
    "ตัวเลือกที่สรุปเกินข้อมูลที่โจทย์กำหนด",
]

ENGLISH_DISTRACTORS = [
    "It contradicts the condition in the question.",
    "It is too broad to answer the topic directly.",
    "It does not match the main idea of the prompt.",
    "It ignores the key constraint in the stem.",
]


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def stable_key(value: object) -> str:
    return normalize_text(value).lower()


def contains_thai(value: str) -> bool:
    return bool(re.search(r"[ก-๙]", value or ""))


def contains_latin(value: str) -> bool:
    return bool(re.search(r"[A-Za-z]", value or ""))


def is_english_subject(subject: str) -> bool:
    return subject == "English Language"


def resolve_profile(subject: str, topic: str) -> str:
    lowered = f"{subject} {topic}".lower()
    if subject == "Government Law & Ethics":
        return "law"
    if subject == "Thai Language":
        return "thai"
    if subject == "English Language":
        return "english"
    for profile, aliases in PROFILE_ALIASES.items():
        if any(alias.lower() in lowered for alias in aliases):
            return profile
    return "analytical"


def get_tokenizer(model_name: str):
    base_model_name = model_name.split(":", 1)[0]
    if model_name in TOKENIZER_CACHE:
        return TOKENIZER_CACHE[model_name]
    try:
        tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    except Exception:
        tokenizer = None
    TOKENIZER_CACHE[model_name] = tokenizer
    return tokenizer


def fit_prompt_to_token_budget(model_name: str, text: str, max_prompt_tokens: int = 2400) -> str:
    tokenizer = get_tokenizer(model_name)
    if tokenizer is not None:
        try:
            token_ids = tokenizer.encode(text)
            if len(token_ids) > max_prompt_tokens:
                text = tokenizer.decode(token_ids[-max_prompt_tokens:], skip_special_tokens=True)
        except Exception:
            pass
    return text


def build_language_rules(subject: str) -> str:
    if is_english_subject(subject):
        return "- Question, choices, and explanation must all be written in English only."
    return "- คำถาม ตัวเลือก และคำอธิบาย ต้องเป็นภาษาไทยทั้งหมด ยกเว้นชื่อหัวข้อภาษาอังกฤษที่จำเป็นต้องคงไว้"


def build_prompts(subject: str, topic: str, difficulty: str, count: int, profile: str, variation_seed: int) -> Dict[str, str]:
    variation_modes = [
        "ใช้โจทย์หลายรูปแบบในชุดเดียวกัน",
        "สลับระหว่างคำถามเชิงประยุกต์ คำถามเชิงวิเคราะห์ และคำถามเชิงหลักการ",
        "หลีกเลี่ยงการใช้ stem ซ้ำหรือโครงประโยคตายตัว",
        "ทำให้ตัวเลือกหลอกสมจริงและไม่ซ้ำกัน",
    ]
    system_prompt = (
        "You are an exam-item writer for Thai civil-service practice tests. "
        "Return valid JSON only. Do not output markdown, code fences, or commentary."
    )
    user_prompt = f"""
สร้างข้อสอบปรนัยจำนวน {count} ข้อ
วิชา: {subject}
หัวข้อย่อย: {topic}
ระดับความยาก: {difficulty}
โปรไฟล์คำถาม: {profile}

ข้อกำหนดบังคับ:
{build_language_rules(subject)}
- ทุกข้อเกี่ยวข้องกับหัวข้อ {topic} โดยตรง
- ทุกข้อมี question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation
- correct_answer ต้องเป็น A, B, C หรือ D เท่านั้น
- ห้ามใช้ตัวเลือก "ถูกทุกข้อ", "ผิดทุกข้อ", "all of the above", "none of the above"
- ตัวเลือกทั้ง 4 ต้องแตกต่างกันชัดเจน
- อย่าสร้างคำถามซ้ำกัน
- {variation_modes[variation_seed % len(variation_modes)]}

รูปแบบ JSON ตัวอย่าง:
{{
  "questions": [
    {{
      "question": "...",
      "choice_a": "...",
      "choice_b": "...",
      "choice_c": "...",
      "choice_d": "...",
      "correct_answer": "A",
      "explanation": "..."
    }}
  ]
}}
""".strip()
    return {"system": system_prompt, "user": user_prompt}


def chat_completion(model_name: str, system_prompt: str, user_prompt: str) -> str:
    shaped_prompt = fit_prompt_to_token_budget(model_name, user_prompt)
    completion = CLIENT.chat_completion(
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": shaped_prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=MAX_NEW_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
        frequency_penalty=0.25,
        presence_penalty=0.2,
    )
    content = completion.choices[0].message.content if completion.choices else ""
    if not content:
        raise RuntimeError("Transformers chat completion returned an empty response")
    return str(content)


def extract_json_block(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    if (cleaned.startswith("{") and cleaned.endswith("}")) or (cleaned.startswith("[") and cleaned.endswith("]")):
        return cleaned
    object_match = re.search(r"\{(?:.|\n|\r)*\}", cleaned)
    if object_match:
        return object_match.group(0)
    list_match = re.search(r"\[(?:.|\n|\r)*\]", cleaned)
    if list_match:
        return list_match.group(0)
    raise ValueError("No JSON payload found in model response")


def escape_control_chars_in_strings(text: str) -> str:
    output: List[str] = []
    in_string = False
    escaping = False
    for char in text:
        if escaping:
            output.append(char)
            escaping = False
            continue
        if char == "\\":
            output.append(char)
            escaping = True
            continue
        if char == '"':
            output.append(char)
            in_string = not in_string
            continue
        if in_string and char == "\n":
            output.append("\\n")
            continue
        if in_string and char == "\r":
            output.append("\\r")
            continue
        if in_string and char == "\t":
            output.append("\\t")
            continue
        output.append(char)
    return "".join(output)


def infer_json_array(subject: str, topic: str, difficulty: str, count: int, profile: str, variation_seed: int) -> List[Dict[str, object]]:
    prompts = build_prompts(subject, topic, difficulty, count, profile, variation_seed)
    errors: List[str] = []
    for model_name in FALLBACK_MODELS:
        try:
            raw_text = chat_completion(model_name, prompts["system"], prompts["user"])
            parsed = json.loads(escape_control_chars_in_strings(extract_json_block(raw_text)))
            if isinstance(parsed, dict) and isinstance(parsed.get("questions"), list):
                return parsed["questions"]
            if isinstance(parsed, dict) and parsed.get("question"):
                return [parsed]
            if isinstance(parsed, list):
                return parsed
        except Exception as exc:
            errors.append(f"{model_name}: {exc}")
    raise RuntimeError(" | ".join(errors) or "Transformers inference failed")


def ensure_topic_in_question(question: str, topic: str) -> str:
    if stable_key(topic) in stable_key(question):
        return question
    return f"[{topic}] {question}"


def unique_choices(correct_text: str, candidate_values: List[str], english_only: bool) -> List[str]:
    seen = set()
    ordered = [correct_text] + candidate_values + (ENGLISH_DISTRACTORS if english_only else THAI_DISTRACTORS)
    choices: List[str] = []
    for value in ordered:
        normalized = stable_key(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        choices.append(normalize_text(value))
        if len(choices) >= 4:
            break
    while len(choices) < 4:
        filler = f"Fallback option {len(choices) + 1}" if english_only else f"ตัวเลือกสำรอง {len(choices) + 1}"
        if stable_key(filler) not in seen:
            seen.add(stable_key(filler))
            choices.append(filler)
    random.shuffle(choices)
    return choices[:4]


def language_is_valid(subject: str, question: str, choices: List[str], explanation: str) -> bool:
    merged = " ".join([question, explanation] + choices)
    if is_english_subject(subject):
        return contains_latin(merged)
    thai_hits = sum(1 for value in [question, explanation] + choices if contains_thai(value))
    return thai_hits >= 4


def normalize_item(item: Dict[str, object], subject: str, topic: str, difficulty: str, profile: str) -> Optional[Dict[str, str]]:
    english_only = is_english_subject(subject)
    question = ensure_topic_in_question(normalize_text(item.get("question")), topic)
    if len(question) < 20:
        return None

    option_list = item.get("options") if isinstance(item.get("options"), list) else []
    raw_choices = [
        normalize_text(item.get("choice_a") or (option_list[0] if len(option_list) > 0 else "")),
        normalize_text(item.get("choice_b") or (option_list[1] if len(option_list) > 1 else "")),
        normalize_text(item.get("choice_c") or (option_list[2] if len(option_list) > 2 else "")),
        normalize_text(item.get("choice_d") or (option_list[3] if len(option_list) > 3 else "")),
    ]
    alt_correct = normalize_text(item.get("correct_choice") or item.get("answer") or item.get("correctAnswer"))
    answer_letter = normalize_text(item.get("correct_answer")).upper()
    answer_index = "ABCD".find(answer_letter)

    if 0 <= answer_index < len(raw_choices) and raw_choices[answer_index]:
        correct_text = raw_choices[answer_index]
    else:
        alt_index = "ABCD".find(alt_correct.upper()) if len(alt_correct) == 1 else -1
        correct_text = raw_choices[alt_index] if 0 <= alt_index < len(raw_choices) and raw_choices[alt_index] else alt_correct or raw_choices[0]

    choices = unique_choices(correct_text, raw_choices, english_only)
    if stable_key(correct_text) not in {stable_key(choice) for choice in choices}:
        return None

    explanation = normalize_text(item.get("explanation"))
    if not explanation:
        explanation = (
            f"คำตอบข้อนี้อ้างอิงหัวข้อ {topic} โดยตรง และตัวเลือกที่ถูกต้องสอดคล้องกับเงื่อนไขของโจทย์มากที่สุด"
            if not english_only
            else f"This answer matches the topic {topic} and satisfies the condition in the question most directly."
        )

    if not language_is_valid(subject, question, choices, explanation):
        return None

    return {
        "question": question,
        "choice_a": choices[0],
        "choice_b": choices[1],
        "choice_c": choices[2],
        "choice_d": choices[3],
        "correct_answer": "ABCD"[choices.index(correct_text)],
        "explanation": explanation,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
    }


def analytical_fallback(topic: str, index: int) -> Dict[str, str]:
    base = 120 + (index * 15)
    delta = 10 + ((index * 7) % 35)
    correct = str(base + delta)
    return {
        "question": f"[{topic}] หากข้อมูลตั้งต้นมีค่า {base} และเพิ่มขึ้นอีก {delta} หน่วย ข้อใดคือผลลัพธ์ที่ถูกต้องที่สุดตามเงื่อนไขของโจทย์นี้?",
        "choice_a": correct,
        "choice_b": str(base + delta + 4),
        "choice_c": str(base + delta - 3),
        "choice_d": str(base + delta + 9),
        "correct_answer": "A",
        "explanation": f"คำนวณจาก {base} + {delta} จะได้ {correct} ซึ่งสอดคล้องกับหัวข้อ {topic}",
    }


def thai_fallback(topic: str, index: int) -> Dict[str, str]:
    stems = [
        f"[{topic}] ข้อใดสรุปใจความสำคัญได้เหมาะสมที่สุดตามหลักของหัวข้อนี้?",
        f"[{topic}] ข้อใดใช้ถ้อยคำได้สอดคล้องกับบริบทของหัวข้อนี้มากที่สุด?",
        f"[{topic}] หากต้องเลือกข้อความที่ตรงประเด็นที่สุด ควรเลือกข้อใด?",
    ]
    return {
        "question": stems[index % len(stems)],
        "choice_a": f"ข้อความที่สอดคล้องกับหลักของ {topic} และตอบโจทย์ได้ตรงประเด็น",
        "choice_b": "ข้อความที่คลุมเครือและไม่ชี้สาระสำคัญ",
        "choice_c": "ข้อความที่ขยายความเกินจากข้อมูลที่กำหนด",
        "choice_d": "ข้อความที่ใช้ถ้อยคำไม่เหมาะกับบริบทของโจทย์",
        "correct_answer": "A",
        "explanation": f"ตัวเลือก A สอดคล้องกับสาระของหัวข้อ {topic} มากที่สุดและไม่สรุปเกินข้อมูล",
    }


def english_fallback(topic: str, index: int) -> Dict[str, str]:
    stems = [
        f"[{topic}] Choose the option that best completes the sentence according to the topic.",
        f"[{topic}] Which option is the most accurate answer for this English objective item?",
        f"[{topic}] Select the choice that fits the grammar and meaning most closely.",
    ]
    return {
        "question": stems[index % len(stems)],
        "choice_a": f"It matches the rule used in {topic}.",
        "choice_b": "It breaks the structure of the sentence.",
        "choice_c": "It changes the meaning of the statement.",
        "choice_d": "It does not fit the condition in the prompt.",
        "correct_answer": "A",
        "explanation": f"Choice A is the best answer because it matches the grammar and meaning required by {topic}.",
    }


def law_fallback(topic: str, index: int) -> Dict[str, str]:
    stems = [
        f"[{topic}] ข้อใดสอดคล้องกับหลักการสำคัญของกฎหมายฉบับนี้มากที่สุด?",
        f"[{topic}] หากโจทย์ถามถึงสาระสำคัญของกฎหมายฉบับนี้ ควรตอบข้อใด?",
        f"[{topic}] ในบริบทของกฎหมายฉบับนี้ ข้อใดเป็นแนวปฏิบัติที่เหมาะสมที่สุด?",
    ]
    return {
        "question": stems[index % len(stems)],
        "choice_a": "การปฏิบัติให้เป็นไปตามอำนาจหน้าที่และขั้นตอนที่กฎหมายกำหนด",
        "choice_b": "การใช้อำนาจโดยไม่ต้องอ้างอิงหลักเกณฑ์ที่เกี่ยวข้อง",
        "choice_c": "การละเว้นขั้นตอนสำคัญแม้กฎหมายกำหนดไว้ชัดเจน",
        "choice_d": "การตีความกฎหมายโดยไม่คำนึงถึงสาระของบทบัญญัติ",
        "correct_answer": "A",
        "explanation": f"หัวข้อ {topic} เน้นการใช้อำนาจและการปฏิบัติให้สอดคล้องกับบทบัญญัติและหลักเกณฑ์ของกฎหมาย",
    }


def fallback_item(subject: str, topic: str, difficulty: str, profile: str, index: int) -> Dict[str, str]:
    if profile == "law":
        row = law_fallback(topic, index)
    elif profile == "english":
        row = english_fallback(topic, index)
    elif profile == "thai":
        row = thai_fallback(topic, index)
    else:
        row = analytical_fallback(topic, index) if profile == "analytical" else (english_fallback(topic, index) if is_english_subject(subject) else thai_fallback(topic, index))
    row["subject"] = subject
    row["topic"] = topic
    row["difficulty"] = difficulty
    return row


def generate_questions(subject: str, topic: str, count: int, difficulty: str) -> List[Dict[str, str]]:
    profile = resolve_profile(subject, topic)
    results: List[Dict[str, str]] = []
    seen_questions = set()
    attempts = 0
    max_attempts = max(40, count * 8)

    while len(results) < count and attempts < max_attempts:
        attempts += 1
        remaining = count - len(results)
        batch_size = min(5, remaining)
        try:
            generated = infer_json_array(subject, topic, difficulty, batch_size, profile, attempts)
        except Exception:
            generated = []

        for item in generated:
            if not isinstance(item, dict):
                continue
            normalized = normalize_item(item, subject, topic, difficulty, profile)
            if not normalized:
                continue
            question_key = stable_key(normalized["question"])
            if question_key in seen_questions:
                continue
            seen_questions.add(question_key)
            results.append(normalized)
            if len(results) >= count:
                break

    fallback_index = 0
    while len(results) < count:
        fallback = fallback_item(subject, topic, difficulty, profile, fallback_index)
        fallback_index += 1
        normalized = normalize_item(fallback, subject, topic, difficulty, profile)
        if not normalized:
            continue
        question_key = stable_key(normalized["question"])
        if question_key in seen_questions:
            continue
        seen_questions.add(question_key)
        results.append(normalized)

    return results[:count]


def main() -> int:
    if not API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY is required for Transformers question generation. Create a Hugging Face token with Inference Providers permission and set it in the environment.")
    payload = json.loads(sys.stdin.read() or "{}")
    subject = str(payload.get("subject") or payload.get("category") or "Analytical Thinking")
    topic = str(payload.get("topic") or payload.get("subcategory") or "Percentage")
    difficulty = str(payload.get("difficulty") or "medium")
    count = int(payload.get("count") or 5)
    questions = generate_questions(subject, topic, count, difficulty)
    if not questions:
        raise RuntimeError("Transformers generator returned zero usable questions")
    print(json.dumps(questions, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
