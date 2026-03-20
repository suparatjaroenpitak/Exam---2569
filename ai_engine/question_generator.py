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
        raise SystemExit(1)#!/usr/bin/env python3
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
TEMPERATURE = float(os.getenv("TRANSFORMERS_TEMPERATURE", "0.95"))
TOP_P = float(os.getenv("TRANSFORMERS_TOP_P", "0.9"))
REPETITION_PENALTY = float(os.getenv("TRANSFORMERS_REPETITION_PENALTY", "1.08"))
RANDOM = random.Random()
TOKENIZER_CACHE: Dict[str, Optional[object]] = {}
CLIENT = InferenceClient(api_key=API_KEY or None, provider=os.getenv("HF_INFERENCE_PROVIDER") or "auto")


PROFILE_ALIASES: Dict[str, List[str]] = {
    "analytical": ["percentage", "ratio", "proportion", "equation", "speed", "sequence", "table", "graph", "chart", "data", "reasoning"],
    "thai": ["reading", "article", "summarize", "interpretation", "word", "sentence", "synonym", "antonym", "ราชาศัพท์"],
    "english": ["tense", "preposition", "conjunction", "article", "vocabulary", "passage", "story"],
    "law": ["พ.ร.บ.", "พ.ร.ฎ.", "ป.อ.", "จริยธรรม", "เจ้าหน้าที่", "ราชการทางปกครอง"],
}


STYLE_GUIDANCE: Dict[str, List[str]] = {
    "analytical": [
        "mix direct calculation, comparison, and short data-interpretation items",
        "avoid reusing the same numeric pattern twice in one batch",
        "every distractor should be numerically plausible but still wrong",
    ],
    "thai": [
        "mix reading inference, sentence correction, and word-usage items",
        "avoid fixed stems that only ask for memorized definitions",
        "keep choices concise and distinct",
    ],
    "english": [
        "mix grammar, vocabulary-in-context, and short reading prompts",
        "keep the sentence natural and exam-like rather than dictionary-like",
        "avoid duplicate synonyms or near-identical answer choices",
    ],
    "law": [
        "mix scenario application, principle identification, exception recognition, and procedural questions",
        "avoid repeatedly asking only which law applies",
        "keep each question tied to the exact law topic but vary the reasoning pattern",
    ],
}


DISTRACTOR_POOLS: Dict[str, List[str]] = {
    "analytical": ["108", "120", "132", "144", "156", "168", "180", "192", "204", "216"],
    "thai": ["ใช้คำได้เหมาะสมตามบริบท", "สื่อความคลาดเคลื่อน", "เรียงลำดับเหตุผลไม่สมบูรณ์", "มีใจความครบถ้วนและชัดเจน"],
    "english": ["fits the context exactly", "has the wrong tense", "breaks the sentence structure", "changes the intended meaning"],
    "law": [
        "หลักความคุ้มค่าในการบริหารราชการ",
        "การรับฟังคู่กรณีก่อนออกคำสั่ง",
        "การใช้อำนาจหน้าที่โดยมิชอบ",
        "การหลีกเลี่ยงผลประโยชน์ทับซ้อน",
        "การไล่เบี้ยเมื่อประมาทเลินเล่ออย่างร้ายแรง",
    ],
}


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def stable_key(value: object) -> str:
    return normalize_text(value).lower()


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
    cached = TOKENIZER_CACHE.get(model_name)
    if cached is not None:
        return cached
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


def topic_anchor(topic: str, profile: str) -> str:
    if profile == "law":
        return f"ทุกคำถามต้องระบุชื่อกฎหมาย '{topic}' ใน stem อย่างชัดเจน"
    return f"ทุกคำถามต้องระบุหัวข้อ '{topic}' ใน stem อย่างน้อย 1 ครั้ง"


def build_prompts(subject: str, topic: str, difficulty: str, count: int, profile: str, variation_seed: int) -> Dict[str, str]:
    style_notes = STYLE_GUIDANCE[profile][:]
    RANDOM.shuffle(style_notes)
    variation_modes = {
        0: "เน้นโจทย์สถานการณ์และเหตุผล",
        1: "เน้นโจทย์เปรียบเทียบหรือหาข้อยกเว้น",
        2: "เน้นโจทย์ประยุกต์ใช้และการวิเคราะห์ตัวเลือก",
        3: "เน้นโจทย์หลายรูปแบบในชุดเดียวกัน",
    }
    system_prompt = (
        "You are an exam-item writer for Thai civil-service practice tests. "
        "Return only valid JSON. Do not include markdown, code fences, commentary, or extra keys. "
        "Every item must have exactly these keys: question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation."
    )
    user_prompt = f"""
สร้างข้อสอบปรนัย {count} ข้อ สำหรับวิชา {subject}
หัวข้อย่อย: {topic}
ระดับความยาก: {difficulty}

ข้อกำหนดบังคับ:
- ตอบเป็น JSON array เท่านั้น
- แต่ละข้อมี choice 4 ตัวเลือกที่ไม่ซ้ำกันและถูกต้องตามตรรกะ
- correct_answer ต้องเป็น A, B, C หรือ D เท่านั้น
- explanation ต้องสั้น กระชับ และอธิบายเหตุผลของคำตอบ
- ห้ามใช้ตัวเลือกประเภท "ถูกทุกข้อ", "ผิดทุกข้อ", "all of the above"
- ห้ามใช้ stem หรือ choice ที่ซ้ำกันในชุดเดียวกัน
- {topic_anchor(topic, profile)}
- {variation_modes[variation_seed % len(variation_modes)]}

แนวทางคุณภาพ:
- {style_notes[0]}
- {style_notes[1]}
- {style_notes[2]}

รูปแบบคำตอบตัวอย่าง:
[
  {{
    "question": "[{topic}] ...",
    "choice_a": "...",
    "choice_b": "...",
    "choice_c": "...",
    "choice_d": "...",
    "correct_answer": "B",
    "explanation": "..."
  }}
]
""".strip()
    return {"system": system_prompt, "user": user_prompt}


def chat_completion(model_name: str, system_prompt: str, user_prompt: str) -> str:
    shaped_user_prompt = fit_prompt_to_token_budget(model_name, user_prompt)
    try:
        completion = CLIENT.chat_completion(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": shaped_user_prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=MAX_NEW_TOKENS,
            temperature=TEMPERATURE,
            top_p=TOP_P,
            frequency_penalty=0.3,
            presence_penalty=0.2,
        )
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc

    message = completion.choices[0].message.content if completion.choices else ""
    if not message:
        raise RuntimeError("Transformers chat completion returned an empty response")
    return str(message)


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
    if cleaned.startswith("[") and cleaned.endswith("]"):
        return cleaned
    match = re.search(r"\[(?:.|\n|\r)*\]", cleaned)
    if match:
        return match.group(0)
    raise ValueError("No JSON array found in model response")


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


def candidate_models() -> List[str]:
    ordered: List[str] = []
    seen = set()
    for name in FALLBACK_MODELS:
        key = normalize_text(name)
        if key and key not in seen:
            seen.add(key)
            ordered.append(name)
    return ordered


def infer_json_array(subject: str, topic: str, difficulty: str, count: int, profile: str, variation_seed: int) -> List[Dict[str, object]]:
    prompts = build_prompts(subject, topic, difficulty, count, profile, variation_seed)
    errors: List[str] = []
    for model_name in candidate_models():
        try:
            raw_text = chat_completion(model_name, prompts["system"], prompts["user"])
            json_block = escape_control_chars_in_strings(extract_json_block(raw_text))
            parsed = json.loads(json_block)
            if isinstance(parsed, dict) and isinstance(parsed.get("questions"), list):
                return parsed["questions"]
            if isinstance(parsed, dict) and parsed.get("question"):
                return [parsed]
            if isinstance(parsed, list):
                return parsed
        except Exception as exc:
            errors.append(f"{model_name}: {exc}")
            continue
    raise RuntimeError(" | ".join(errors) or "Transformers inference failed")


def unique_choices(correct_text: str, candidate_values: List[str], profile: str) -> List[str]:
    seen = set()
    choices: List[str] = []
    for value in [correct_text] + candidate_values + DISTRACTOR_POOLS[profile]:
        normalized = stable_key(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        choices.append(normalize_text(value))
        if len(choices) >= 4:
            break
    while len(choices) < 4:
        filler = f"ทางเลือกสำรอง {len(choices) + 1}"
        if stable_key(filler) not in seen:
            seen.add(stable_key(filler))
            choices.append(filler)
    RANDOM.shuffle(choices)
    return choices[:4]


def ensure_topic_in_question(question: str, topic: str) -> str:
    if stable_key(topic) in stable_key(question):
        return question
    return f"[{topic}] {question}"


def normalize_item(item: Dict[str, object], subject: str, topic: str, difficulty: str, profile: str) -> Optional[Dict[str, str]]:
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
    correct_answer = normalize_text(item.get("correct_answer")).upper()
    correct_index = "ABCD".find(correct_answer)
    alt_correct = normalize_text(item.get("correct_choice") or item.get("answer") or item.get("correctAnswer"))

    if correct_index >= 0 and correct_index < len(raw_choices):
        correct_text = raw_choices[correct_index]
    else:
        alt_index = "ABCD".find(alt_correct.upper()) if len(alt_correct) == 1 else -1
        if alt_index >= 0 and alt_index < len(raw_choices):
            correct_text = raw_choices[alt_index]
        else:
            correct_text = alt_correct or raw_choices[0]

    choices = unique_choices(correct_text, raw_choices, profile)
    if stable_key(correct_text) not in {stable_key(choice) for choice in choices}:
        choices[0] = correct_text
        choices = unique_choices(correct_text, choices, profile)

    correct_letter = "ABCD"[choices.index(correct_text)] if correct_text in choices else "A"
    explanation = normalize_text(item.get("explanation"))
    if not explanation:
        explanation = f"ข้อนี้อ้างอิงสาระของหัวข้อ {topic} และตัวเลือกที่ถูกต้องคือ {correct_letter} เพราะสอดคล้องกับเงื่อนไขของโจทย์มากที่สุด"

    return {
        "question": question,
        "choice_a": choices[0],
        "choice_b": choices[1],
        "choice_c": choices[2],
        "choice_d": choices[3],
        "correct_answer": correct_letter,
        "explanation": explanation,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
    }


def generate_questions(subject: str, topic: str, count: int, difficulty: str) -> List[Dict[str, str]]:
    profile = resolve_profile(subject, topic)
    results: List[Dict[str, str]] = []
    seen_questions = set()
    attempts = max(4, min(8, count + 2))

    for attempt in range(attempts):
        remaining = count - len(results)
        if remaining <= 0:
            break
        batch_size = min(remaining, 4)
        generated = infer_json_array(subject, topic, difficulty, batch_size, profile, attempt)
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

    return results[:count]


def main() -> int:
    if not API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY is required for Transformers question generation. Create a Hugging Face token with Inference Providers permission and set it in the environment.")
    payload = json.loads(sys.stdin.read() or "{}")
    subject = str(payload.get("subject") or "Analytical Thinking")
    topic = str(payload.get("topic") or "Percentage")
    count = int(payload.get("count") or 5)
    difficulty = str(payload.get("difficulty") or "medium")
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
        raise SystemExit(1)#!/usr/bin/env python3
import json
import math
import random
import sys
from typing import Callable, Dict, List, Tuple

try:
    import markovify
except Exception:
    markovify = None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except Exception:
    TfidfVectorizer = None
    cosine_similarity = None


MARKOV_CORPORA: Dict[str, List[str]] = {
    "analytical": [
        "โจทย์การคิดวิเคราะห์ที่ดีต้องค่อย ๆ แยกข้อมูลและมองความสัมพันธ์ของตัวเลขอย่างเป็นขั้นตอน",
        "การอ่านตาราง กราฟ หรือแผนภูมิควรดูค่ามากสุด น้อยสุด และผลต่างก่อนสรุปคำตอบ",
        "โจทย์ลำดับและเหตุผลเชิงตรรกะต้องสังเกตรูปแบบที่ซ่อนอยู่ก่อนตัดตัวเลือก",
    ],
    "thai": [
        "การตอบข้อสอบภาษาไทยควรยึดใจความของข้อความและการใช้คำที่ถูกต้องตามบริบท",
        "การสรุปความและการตีความต้องไม่เติมข้อมูลเกินจากสิ่งที่ผู้เขียนสื่อไว้",
        "การเลือกคำและโครงสร้างประโยคที่เหมาะสมช่วยให้ความหมายชัดเจนและครบถ้วน",
    ],
    "english": [
        "Strong English questions use context, grammar, and meaning together.",
        "The best option should fit both the sentence structure and the intended meaning.",
        "Reading questions should be answered from the passage, not from outside assumptions.",
    ],
    "law": [
        "ข้อสอบกฎหมายที่ดีต้องยึดคำสำคัญและสาระของบทบัญญัติให้ตรงกับกฎหมายแต่ละฉบับ",
        "การเลือกคำตอบในข้อสอบกฎหมายควรพิจารณาว่าประเด็นนั้นเกี่ยวกับอำนาจหน้าที่ ขั้นตอน หรือความรับผิดแบบใด",
        "คำอธิบายกฎหมายที่กระชับควรชี้ให้เห็นหลักการของกฎหมายและเหตุผลที่ใช้บทบัญญัตินั้น",
    ],
}


def normalize(value: str) -> str:
    return str(value or "").replace("%", "").strip().lower()


def format_number(value: float, suffix: str = "") -> str:
    if abs(value - int(value)) < 1e-9:
        return f"{int(value)}{suffix}"
    return f"{round(value, 2):g}{suffix}"


def ai_phrase(group: str, fallback: str) -> str:
    if not markovify:
        return fallback
    try:
        model = markovify.NewlineText("\n".join(MARKOV_CORPORA[group]), state_size=1, well_formed=False)
        sentence = model.make_short_sentence(90, tries=50)
        return sentence or fallback
    except Exception:
        return fallback


def random_numeric_choices(correct: float, suffix: str = "") -> List[str]:
    options = {format_number(correct, suffix)}
    attempts = 0
    while len(options) < 4 and attempts < 60:
        delta = random.choice([-12, -8, -5, -3, 3, 5, 8, 12])
        candidate = correct + delta
        if suffix == "%":
            candidate = max(0, min(100, candidate))
        options.add(format_number(candidate, suffix))
        attempts += 1
    while len(options) < 4:
        options.add(format_number(correct + random.randint(1, 15), suffix))
    shuffled = list(options)
    random.shuffle(shuffled)
    return shuffled[:4]


def build_row(question: str, correct: str, distractors: List[str], explanation: str, subject: str, topic: str, difficulty: str) -> Dict:
    options = [correct] + [item for item in distractors if normalize(item) != normalize(correct)]
    deduped = []
    seen = set()
    for option in options:
        key = normalize(option)
        if key and key not in seen:
            deduped.append(option)
            seen.add(key)
    while len(deduped) < 4:
        filler = f"ตัวเลือกเพิ่มเติม {len(deduped) + 1}"
        if normalize(filler) not in seen:
            deduped.append(filler)
            seen.add(normalize(filler))
    deduped = deduped[:4]
    random.shuffle(deduped)
    correct_answer = "ABCD"[deduped.index(correct)] if correct in deduped else "A"
    return {
        "question": question,
        "choice_a": deduped[0],
        "choice_b": deduped[1],
        "choice_c": deduped[2],
        "choice_d": deduped[3],
        "correct_answer": correct_answer,
        "explanation": explanation,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
    }


TOPIC_PROFILES: Dict[str, List[str]] = {
    "percentage": ["percentage", "percent", "ร้อยละ", "เปอร์เซ็นต์"],
    "ratio": ["ratio", "อัตราส่วน", "proportion", "สัดส่วน"],
    "equation": ["equation", "สมการ"],
    "speed": ["speed distance time", "อัตราเร็ว", "ระยะทาง", "เวลา"],
    "comparison": ["number comparison", "เปรียบเทียบ", "มากกว่า", "น้อยกว่า"],
    "table": ["data tables", "tables", "table", "graphs", "charts", "data interpretation", "ตาราง", "กราฟ", "แผนภูมิ"],
    "sequence": ["sequence", "ลำดับ", "อนุกรม", "truth tables"],
    "logic": ["logical reasoning", "symbolic conditions", "language conditions", "relationship finding", "odd-one-out", "ตรรกะ", "เงื่อนไข"],
    "thai_reading": ["reading comprehension", "analyze article", "summarize", "interpretation", "บทความ", "จับใจความ", "สรุปความ"],
    "thai_word": ["correct word", "incorrect word", "sentence structure", "conjunction usage", "complete sentence", "word groups", "โครงสร้างประโยค", "สันธาน"],
    "thai_vocab": ["synonym", "antonym", "thai royal vocabulary", "คำไวพจน์", "คำตรงข้าม", "ราชาศัพท์"],
    "english_grammar": ["tense", "preposition", "conjunction", "article", "fill in the blank"],
    "english_vocab": ["vocabulary synonym", "vocabulary antonym"],
    "english_reading": ["passage reading", "story questions", "passage", "story", "dialogue"],
    "law": [
        "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534",
        "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546",
        "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539",
        "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)",
        "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่",
        "พ.ร.บ.มาตราฐานทางจริยธรรม 2562",
    ],
}


LAW_CONCEPTS = {
    "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": [
        "การแบ่งส่วนราชการส่วนกลาง ส่วนภูมิภาค และส่วนท้องถิ่น",
        "อำนาจหน้าที่ของคณะรัฐมนตรี นายกรัฐมนตรี และกระทรวงทบวงกรม",
        "หลักการจัดระเบียบบริหารราชการแผ่นดิน",
        "ความสัมพันธ์ในการบังคับบัญชาระหว่างส่วนราชการ",
        "การแบ่งส่วนราชการและการมอบอำนาจในระบบราชการ",
        "โครงสร้างการบริหารราชการของฝ่ายบริหาร",
    ],
    "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": [
        "การบริหารเพื่อประโยชน์สุขของประชาชน",
        "การลดขั้นตอนการปฏิบัติงานของภาครัฐ",
        "การประเมินผลสัมฤทธิ์ของภารกิจภาครัฐ",
        "หลักความคุ้มค่าและความโปร่งใสในการบริหารราชการ",
        "การพัฒนาคุณภาพการให้บริการภาครัฐ",
        "การอำนวยความสะดวกแก่ประชาชนอย่างมีประสิทธิภาพ",
    ],
    "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": [
        "การออกคำสั่งทางปกครองอย่างเป็นธรรม",
        "สิทธิของคู่กรณีในการรับฟังพยานหลักฐาน",
        "การแจ้งเหตุผลของคำสั่งทางปกครอง",
        "การเพิกถอนหรือแก้ไขคำสั่งทางปกครอง",
        "ขั้นตอนปฏิบัติของเจ้าหน้าที่ในเรื่องทางปกครอง",
        "ความเป็นธรรมในกระบวนการพิจารณาทางปกครอง",
    ],
    "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": [
        "เจ้าพนักงานใช้อำนาจหน้าที่โดยมิชอบ",
        "การเรียกรับผลประโยชน์โดยมิชอบ",
        "การละเว้นการปฏิบัติหน้าที่โดยทุจริต",
        "ความรับผิดทางอาญาของเจ้าพนักงาน",
        "ความผิดเกี่ยวกับตำแหน่งหน้าที่ของเจ้าพนักงาน",
        "การทุจริตจากการใช้อำนาจรัฐโดยมิชอบ",
    ],
    "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": [
        "ความรับผิดของหน่วยงานรัฐจากการละเมิดของเจ้าหน้าที่",
        "การไล่เบี้ยเมื่อเจ้าหน้าที่จงใจหรือประมาทเลินเล่ออย่างร้ายแรง",
        "การชดใช้ค่าสินไหมทดแทนแก่ผู้เสียหาย",
        "เงื่อนไขการเรียกให้เจ้าหน้าที่รับผิดเป็นการส่วนตัว",
        "หลักเกณฑ์เมื่อเจ้าหน้าที่กระทำละเมิดระหว่างปฏิบัติหน้าที่",
        "การรับผิดชอบของรัฐต่อความเสียหายที่เกิดแก่เอกชน",
    ],
    "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": [
        "มาตรฐานจริยธรรมของเจ้าหน้าที่ของรัฐ",
        "การหลีกเลี่ยงผลประโยชน์ทับซ้อน",
        "การยึดมั่นประโยชน์ส่วนรวมและความซื่อสัตย์สุจริต",
        "ค่านิยมด้านความรับผิดชอบและคุณธรรม",
        "กลไกกำกับดูแลการประพฤติทางจริยธรรม",
        "การประพฤติตนตามมาตรฐานจริยธรรมของรัฐ",
    ],
}

LAW_APPLY_TEMPLATES = [
    "หากหน่วยงานรัฐต้องพิจารณาเรื่อง \"{clue}\" ประเด็นนี้ควรผูกกับกฎหมายฉบับใดมากที่สุด?",
    "ถ้าข้อสอบกล่าวถึง \"{clue}\" ผู้สอบควรเชื่อมโยงไปยังกฎหมายฉบับใด?",
    "ประเด็น \"{clue}\" เป็นสาระที่เด่นของกฎหมายฉบับใดมากที่สุด?",
    "สถานการณ์ที่เกี่ยวกับ \"{clue}\" ควรอ้างอิงกฎหมายใดเป็นหลัก?",
]

LAW_CONCEPT_TEMPLATES = [
    "ตาม {act} ข้อใดเป็นสาระสำคัญที่สอดคล้องกับกฎหมายฉบับนี้มากที่สุด?",
    "หากออกข้อสอบเฉพาะเรื่อง {act} ข้อใดควรเป็นคำตอบที่ถูกต้องที่สุด?",
    "ข้อใดอยู่ในขอบเขตเนื้อหาของ {act} มากที่สุด?",
    "สาระใดต่อไปนี้สอดคล้องกับ {act} โดยตรง?",
]

LAW_EXCEPT_TEMPLATES = [
    "ข้อใดไม่ใช่สาระหลักของ {act}?",
    "หากโจทย์กำหนดว่าเนื้อหาอยู่ภายใต้ {act} ข้อใดต่อไปนี้ไม่เข้าพวก?",
    "ข้อใดไม่สอดคล้องกับหลักสำคัญของ {act}?",
]


def sample_other_law_concepts(selected_act: str, count: int) -> List[str]:
    pool: List[str] = []
    for act, clues in LAW_CONCEPTS.items():
        if act == selected_act:
            continue
        pool.extend(clues)
    random.shuffle(pool)
    output: List[str] = []
    seen = set()
    for clue in pool:
        key = normalize(clue)
        if key in seen:
            continue
        seen.add(key)
        output.append(clue)
        if len(output) >= count:
            break
    return output


def unique_distractors(correct: str, pool: List[str], count: int) -> List[str]:
    output: List[str] = []
    seen = {normalize(correct)}
    for item in pool:
        key = normalize(item)
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
        if len(output) >= count:
            break
    return output


def resolve_profile(subject: str, topic: str) -> str:
    normalized_topic = str(topic or "").strip().lower()
    for key, aliases in TOPIC_PROFILES.items():
        if any(normalized_topic == alias.lower() for alias in aliases):
            return key

    if TfidfVectorizer is not None and cosine_similarity is not None and normalized_topic:
        keys = list(TOPIC_PROFILES.keys())
        docs = [" ".join(TOPIC_PROFILES[key]) for key in keys]
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
        matrix = vectorizer.fit_transform(docs + [normalized_topic])
        similarity = cosine_similarity(matrix[-1], matrix[:-1]).flatten()
        best_index = int(similarity.argmax())
        if similarity[best_index] > 0.12:
            return keys[best_index]

    if subject == "Thai Language":
        return "thai_reading"
    if subject == "English Language":
        return "english_grammar"
    if subject == "Government Law & Ethics":
        return "law"
    return "table"


def generate_percentage(subject: str, topic: str, difficulty: str) -> Dict:
    mode = random.choice(["part", "increase", "discount", "reverse"])
    if mode == "part":
        percent = random.randint(10, 80)
        total = random.choice([120, 160, 240, 360, 480])
        correct_value = total * percent / 100
        question = f"ข้อสอบหัวข้อ {topic}: ร้อยละ {percent} ของ {total} มีค่าเท่าใด หากต้องคำนวณอย่างถูกต้องตามหลัก percentage?"
        explanation = f"{ai_phrase('analytical', 'เริ่มจากคำนวณร้อยละของจำนวนทั้งหมดก่อน')} คำนวณจาก {percent}/100 x {total} ได้ {format_number(correct_value)}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    if mode == "increase":
        base = random.randint(150, 900)
        percent = random.randint(5, 25)
        correct_value = base * (1 + percent / 100)
        question = f"ข้อสอบหัวข้อ {topic}: สินค้าราคา {base} บาท เพิ่มขึ้น {percent}% ราคาหลังเพิ่มจะเป็นเท่าใด?"
        explanation = f"{ai_phrase('analytical', 'โจทย์เปอร์เซ็นต์เพิ่มต้องหาค่าหลังเพิ่มจากฐานเดิม')} นำ {base} คูณด้วย 1 + {percent}/100 จะได้ {format_number(correct_value)}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    if mode == "discount":
        base = random.randint(200, 1500)
        percent = random.randint(10, 35)
        correct_value = base * (1 - percent / 100)
        question = f"ข้อสอบหัวข้อ {topic}: สินค้าราคา {base} บาท ลดราคา {percent}% จะเหลือราคาสุทธิเท่าใด?"
        explanation = f"{ai_phrase('analytical', 'โจทย์เปอร์เซ็นต์ลดต้องหามูลค่าที่เหลือหลังหักส่วนลด')} คำนวณ {base} x (1 - {percent}/100) ได้ {format_number(correct_value)}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    total = random.randint(80, 300)
    part = random.randint(20, total - 10)
    correct_value = part / total * 100
    question = f"ข้อสอบหัวข้อ {topic}: หาก {part} คิดเป็นกี่เปอร์เซ็นต์ของ {total} จงเลือกคำตอบที่ถูกต้องที่สุด"
    explanation = f"{ai_phrase('analytical', 'โจทย์ย้อนหาร้อยละต้องเปรียบเทียบส่วนย่อยกับจำนวนทั้งหมด')} นำ {part} หารด้วย {total} แล้วคูณ 100 จะได้ {format_number(correct_value, '%')}"
    choices = random_numeric_choices(correct_value, "%")
    return build_row(question, format_number(correct_value, "%"), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value, '%'))], explanation, subject, topic, difficulty)


def generate_ratio(subject: str, topic: str, difficulty: str) -> Dict:
    left = random.randint(2, 7)
    right = random.randint(3, 9)
    multiplier = random.randint(3, 8)
    total = (left + right) * multiplier
    correct_value = right * multiplier
    question = f"โจทย์ {topic}: ห้องหนึ่งมีนักเรียนชายต่อหญิงในอัตราส่วน {left}:{right} ถ้ามีนักเรียนรวม {total} คน จำนวนนักเรียนหญิงมีเท่าใด?"
    explanation = f"{ai_phrase('analytical', 'โจทย์อัตราส่วนต้องแปลงส่วนให้เป็นจำนวนจริงก่อน')} ผลรวมส่วนคือ {left + right} จึงมีตัวคูณเท่ากับ {multiplier} และนักเรียนหญิงมี {correct_value} คน"
    choices = random_numeric_choices(correct_value)
    return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)


def generate_equation(subject: str, topic: str, difficulty: str) -> Dict:
    x_value = random.randint(3, 18)
    coefficient = random.randint(2, 6)
    constant = random.randint(3, 15)
    rhs = coefficient * x_value + constant
    question = f"โจทย์ {topic}: ถ้า {coefficient}x + {constant} = {rhs} แล้วค่า x มีค่าเท่าใด?"
    explanation = f"{ai_phrase('analytical', 'โจทย์สมการควรจัดรูปให้เหลือตัวแปรเพียงด้านเดียว')} ย้าย {constant} ไปอีกข้างจะได้ {coefficient}x = {rhs - constant} ดังนั้น x = {x_value}"
    choices = random_numeric_choices(x_value)
    return build_row(question, format_number(x_value), [choice for choice in choices if normalize(choice) != normalize(format_number(x_value))], explanation, subject, topic, difficulty)


def generate_speed(subject: str, topic: str, difficulty: str) -> Dict:
    speed = random.randint(40, 90)
    hours = random.choice([1.5, 2, 2.5, 3, 3.5])
    distance = speed * hours
    question = f"โจทย์ {topic}: รถคันหนึ่งวิ่งด้วยความเร็ว {speed} กิโลเมตรต่อชั่วโมง เป็นเวลา {hours} ชั่วโมง จะเดินทางได้ระยะทางเท่าใด?"
    explanation = f"{ai_phrase('analytical', 'โจทย์อัตราเร็ว ระยะทาง เวลา ควรเริ่มจากการเลือกสูตรที่ตรงกับสิ่งที่ถาม')} ใช้สูตร ระยะทาง = ความเร็ว x เวลา ดังนั้นได้ {format_number(distance)} กิโลเมตร"
    choices = random_numeric_choices(distance)
    return build_row(question, format_number(distance), [choice for choice in choices if normalize(choice) != normalize(format_number(distance))], explanation, subject, topic, difficulty)


def generate_comparison(subject: str, topic: str, difficulty: str) -> Dict:
    items = {
        f"{random.randint(20, 45)}%": random.randint(20, 45) / 100,
        f"{random.randint(1, 4)}/{random.randint(5, 9)}": 0,
        format_number(random.choice([0.25, 0.4, 0.6, 0.75])): random.choice([0.25, 0.4, 0.6, 0.75]),
        f"{random.randint(2, 7)}:{random.randint(8, 12)}": 0,
    }
    normalized = {}
    for label in list(items.keys()):
        if "/" in label:
            a, b = label.split("/")
            normalized[label] = int(a) / int(b)
        elif ":" in label:
            a, b = label.split(":")
            normalized[label] = int(a) / int(b)
        elif label.endswith("%"):
            normalized[label] = float(label[:-1]) / 100
        else:
            normalized[label] = float(label)
    correct = max(normalized, key=normalized.get)
    distractors = [label for label in normalized.keys() if label != correct]
    question = f"โจทย์ {topic}: ข้อใดมีค่ามากที่สุดเมื่อเปรียบเทียบเป็นจำนวนเดียวกัน?"
    explanation = f"{ai_phrase('analytical', 'การเปรียบเทียบจำนวนควรทำให้อยู่ในรูปเดียวกันก่อน')} เมื่อแปลงทุกตัวเลือกให้อยู่ในรูปทศนิยม จะพบว่า {correct} มีค่ามากที่สุด"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_table(subject: str, topic: str, difficulty: str) -> Dict:
    labels = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี"]
    values = random.sample(range(110, 260, 10), 4)
    mode = random.choice(["highest", "difference", "average"])
    table_text = "; ".join([f"{label} = {value}" for label, value in zip(labels, values)])
    if mode == "highest":
        best_index = values.index(max(values))
        correct = labels[best_index]
        distractors = [label for label in labels if label != correct]
        question = f"โจทย์ {topic}: จากตารางข้อมูลยอดขายต่อวันดังนี้ {table_text} วันใดมียอดขายสูงที่สุด?"
        explanation = f"{ai_phrase('analytical', 'การอ่านตารางข้อมูลควรดูค่าที่โดดเด่นก่อน')} พิจารณาค่าสูงสุดในตารางจะพบว่า {correct} มียอดขายมากที่สุด"
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    if mode == "difference":
        first = random.randint(0, 2)
        second = first + 1
        correct_value = abs(values[first] - values[second])
        question = f"โจทย์ {topic}: จากตารางข้อมูล {table_text} ผลต่างของยอดขายระหว่าง {labels[first]} และ {labels[second]} เท่ากับเท่าใด?"
        explanation = f"{ai_phrase('analytical', 'การหาผลต่างจากข้อมูลในตารางต้องเทียบสองค่าที่โจทย์ระบุ')} นำ {values[first]} ลบ {values[second]} แบบค่าสัมบูรณ์ จะได้ {correct_value}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    average = sum(values) / len(values)
    correct_candidates = [label for label, value in zip(labels, values) if value > average]
    correct = correct_candidates[0]
    distractors = [label for label in labels if label != correct]
    question = f"โจทย์ {topic}: จากตารางข้อมูล {table_text} หากค่าเฉลี่ยยอดขายเท่ากับ {format_number(average)} วันใดมียอดขายสูงกว่าค่าเฉลี่ยแน่นอน?"
    explanation = f"{ai_phrase('analytical', 'การตีความข้อมูลควรเริ่มจากหาค่าอ้างอิงที่ใช้เปรียบเทียบ')} ค่าเฉลี่ยของข้อมูลคือ {format_number(average)} และ {correct} มียอดขายสูงกว่าค่าเฉลี่ย"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_sequence(subject: str, topic: str, difficulty: str) -> Dict:
    mode = random.choice(["arithmetic", "power", "fraction"])
    if mode == "arithmetic":
        start = random.randint(2, 10)
        step = random.randint(2, 6)
        series = [start + step * index for index in range(5)]
        correct_value = series[-1] + step
        question = f"โจทย์ {topic}: ลำดับ {', '.join(str(value) for value in series)} ข้อถัดไปควรเป็นจำนวนใด?"
        explanation = f"{ai_phrase('analytical', 'โจทย์ลำดับต้องสังเกตการเปลี่ยนแปลงของแต่ละพจน์อย่างสม่ำเสมอ')} เป็นลำดับเพิ่มทีละ {step} ดังนั้นคำตอบคือ {correct_value}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    if mode == "power":
        base = random.randint(2, 4)
        series = [base ** exponent for exponent in range(1, 5)]
        correct_value = base ** 5
        question = f"โจทย์ {topic}: ลำดับ {', '.join(str(value) for value in series)} มีความสัมพันธ์แบบยกกำลัง ข้อถัดไปคือข้อใด?"
        explanation = f"{ai_phrase('analytical', 'ลำดับยกกำลังควรดูความสัมพันธ์ของฐานและชี้กำลัง')} ตัวเลขเป็นกำลังของ {base} ดังนั้นค่าถัดไปคือ {correct_value}"
        choices = random_numeric_choices(correct_value)
        return build_row(question, format_number(correct_value), [choice for choice in choices if normalize(choice) != normalize(format_number(correct_value))], explanation, subject, topic, difficulty)

    numerators = [1, 2, 3, 4]
    denominators = [2, 3, 4, 5]
    sequence_labels = [f"{n}/{d}" for n, d in zip(numerators, denominators)]
    correct = "5/6"
    question = f"โจทย์ {topic}: ลำดับเศษส่วน {', '.join(sequence_labels)} ข้อถัดไปควรเป็นข้อใด หากตัวเศษและตัวส่วนเพิ่มขึ้นทีละ 1?"
    explanation = f"{ai_phrase('analytical', 'โจทย์ลำดับเศษส่วนต้องดูรูปแบบของทั้งตัวเศษและตัวส่วน')} ตัวเศษและตัวส่วนเพิ่มขึ้นพร้อมกันทีละ 1 ดังนั้นพจน์ถัดไปคือ 5/6"
    return build_row(question, correct, ["5/7", "6/7", "4/6"], explanation, subject, topic, difficulty)


def generate_logic(subject: str, topic: str, difficulty: str) -> Dict:
    premises = [
        ("นักเรียนทุกคนที่ฝึกโจทย์สม่ำเสมอจะทำคะแนนดี", "เมธาฝึกโจทย์สม่ำเสมอ", "เมธาทำคะแนนดี"),
        ("ผู้ที่มาถึงตรงเวลาทุกคนจะได้ลงทะเบียนก่อน", "ศิริพรมาเรียนตรงเวลา", "ศิริพรได้ลงทะเบียนก่อน"),
        ("ข้าราชการที่ปฏิบัติตามระเบียบจะไม่ถูกตักเตือน", "อนันต์ปฏิบัติตามระเบียบ", "อนันต์ไม่ถูกตักเตือน"),
    ]
    major, minor, conclusion = random.choice(premises)
    question = f"โจทย์ {topic}: หากทราบว่า '{major}' และ '{minor}' ข้อใดเป็นข้อสรุปที่สมเหตุสมผลที่สุด?"
    distractors = [
        "ยังสรุปอะไรไม่ได้เลย",
        "ข้อสรุปเป็นจริงในกรณีตรงข้ามเท่านั้น",
        "ข้อมูลขัดแย้งกันจึงใช้สรุปไม่ได้",
    ]
    explanation = f"{ai_phrase('analytical', 'เหตุผลเชิงตรรกะต้องยึดข้อความตั้งต้นและไม่สรุปเกินเงื่อนไข')} เป็นการอนุมานแบบตรรกะจากกฎทั่วไปไปยังกรณีเฉพาะ จึงสรุปตามข้อความที่กำหนดได้"
    return build_row(question, conclusion, distractors, explanation, subject, topic, difficulty)


def generate_thai_reading(subject: str, topic: str, difficulty: str) -> Dict:
    passage = random.choice([
        "ชุมชนแห่งหนึ่งร่วมกันคัดแยกขยะและนำวัสดุที่ใช้ซ้ำได้กลับมาใช้ใหม่ ทำให้ปริมาณขยะลดลงและค่าใช้จ่ายในการกำจัดขยะของชุมชนลดลงอย่างชัดเจน",
        "โรงเรียนจัดกิจกรรมอ่านหนังสือก่อนเข้าเรียนวันละสิบห้านาทีอย่างต่อเนื่อง ส่งผลให้นักเรียนมีสมาธิและผลการเรียนด้านการอ่านดีขึ้น",
        "หน่วยงานภาครัฐปรับขั้นตอนการให้บริการให้สั้นลง พร้อมเปิดระบบจองคิวออนไลน์ ทำให้ประชาชนรอคิวน้อยลงและเข้าถึงบริการสะดวกขึ้น",
    ])
    question = f"โจทย์ {topic}: อ่านข้อความต่อไปนี้แล้วตอบคำถาม '{passage}' ใจความสำคัญของข้อความนี้คือข้อใด?"
    correct = random.choice([
        "การปรับพฤติกรรมหรือกระบวนการที่เหมาะสมช่วยให้เกิดผลลัพธ์ที่ดีขึ้น",
        "การทำงานอย่างเป็นระบบช่วยเพิ่มประสิทธิภาพและประโยชน์ต่อส่วนรวม",
    ])
    distractors = [
        "ผู้คนควรหลีกเลี่ยงการเปลี่ยนแปลงทุกกรณี",
        "ผลลัพธ์ที่ดีเกิดจากโชคมากกว่าการวางแผน",
        "การทำงานร่วมกันมักทำให้กระบวนการช้าลงเสมอ",
    ]
    explanation = f"{ai_phrase('thai', 'การจับใจความควรยึดสารที่ผู้เขียนสื่อไว้เป็นหลัก')} ใจความสำคัญมุ่งแสดงให้เห็นว่าการปรับวิธีดำเนินงานอย่างเหมาะสมทำให้เกิดผลดีต่อบุคคลหรือส่วนรวม"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_thai_word(subject: str, topic: str, difficulty: str) -> Dict:
    if topic == "Incorrect Word":
        question = "โจทย์ Incorrect Word: ข้อใดใช้คำไม่ถูกต้องตามความหมายในบริบทของภาษาไทยมาตรฐาน?"
        correct = "เขารับประทานยารักษาโรคอย่างเคร่งครัดทุกวัน"
        distractors = [
            "คณะทำงานประชุมเพื่อกำหนดแนวทางดำเนินงาน",
            "นักเรียนช่วยกันทำความสะอาดห้องเรียนหลังเลิกเรียน",
            "เธออุปโภคข่าวสารจากโทรทัศน์ทุกเช้า",
        ]
        explanation = f"{ai_phrase('thai', 'การใช้คำต้องพิจารณาความหมายตามบริบทให้ถูกต้อง')} คำว่า 'อุปโภค' ใช้กับสิ่งของที่ไม่ใช่อาหารหรือข่าวสาร การใช้กับข่าวสารจึงไม่เหมาะสม"
        return build_row(question, "เธออุปโภคข่าวสารจากโทรทัศน์ทุกเช้า", [choice for choice in distractors if choice != "เธออุปโภคข่าวสารจากโทรทัศน์ทุกเช้า"] + [correct], explanation, subject, topic, difficulty)

    question = f"โจทย์ {topic}: ข้อใดเชื่อมความในประโยคได้เหมาะสมและทำให้ประโยคสมบูรณ์ที่สุด?"
    correct = "แม้ฝนจะตกหนัก แต่เจ้าหน้าที่ยังคงปฏิบัติงานตามหน้าที่"
    distractors = [
        "แม้ฝนจะตกหนัก เพราะเจ้าหน้าที่ยังคงปฏิบัติงานตามหน้าที่",
        "แม้ฝนจะตกหนัก และเจ้าหน้าที่ยังคงปฏิบัติงานตามหน้าที่ แต่",
        "เพราะแม้ฝนจะตกหนัก แต่เจ้าหน้าที่ยังคงปฏิบัติงานตามหน้าที่ เพราะ",
    ]
    explanation = f"{ai_phrase('thai', 'โครงสร้างประโยคที่ดีต้องเชื่อมความได้พอดีและชัดเจน')} ประโยคที่ถูกต้องต้องใช้คำเชื่อมสัมพันธ์กันและไม่มีส่วนเกิน ทำให้ใจความสมบูรณ์"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_thai_vocab(subject: str, topic: str, difficulty: str) -> Dict:
    if topic == "Antonym":
        question = "โจทย์ Antonym: คำใดมีความหมายตรงข้ามกับคำว่า 'ประหยัด' มากที่สุด?"
        correct = "ฟุ่มเฟือย"
        distractors = ["พอเพียง", "ละเอียด", "สุขุม"]
        explanation = f"{ai_phrase('thai', 'โจทย์คำศัพท์ควรพิจารณาความหมายตรงและความหมายแฝงของคำ')} คำว่า 'ประหยัด' มีความหมายตรงข้ามกับ 'ฟุ่มเฟือย'"
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    if topic == "Thai Royal Vocabulary":
        question = "โจทย์ Thai Royal Vocabulary: ข้อใดเป็นราชาศัพท์ที่ใช้แทนคำว่า 'กิน' ได้ถูกต้อง?"
        correct = "เสวย"
        distractors = ["รับประทาน", "บริโภค", "ทาน"]
        explanation = f"{ai_phrase('thai', 'การใช้ราชาศัพท์ต้องเลือกคำที่ตรงกับฐานะและบริบท')} คำราชาศัพท์ที่ใช้แทนคำว่า 'กิน' คือ 'เสวย'"
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    question = f"โจทย์ {topic}: คำใดมีความหมายใกล้เคียงกับคำว่า 'รวดเร็ว' มากที่สุด?"
    correct = "ฉับไว"
    distractors = ["เชื่องช้า", "มั่นคง", "ละเอียด"]
    explanation = f"{ai_phrase('thai', 'โจทย์คำไวพจน์ต้องเทียบความหมายของคำโดยตรง')} คำว่า 'ฉับไว' มีความหมายใกล้เคียงกับ 'รวดเร็ว' มากที่สุด"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_english_grammar(subject: str, topic: str, difficulty: str) -> Dict:
    if topic == "Preposition":
        question = "English Preposition: Choose the correct preposition to complete the sentence 'The meeting starts ___ 9 a.m. every Monday.'"
        correct = "at"
        distractors = ["in", "on", "for"]
        explanation = f"{ai_phrase('english', 'Choose the word that matches the grammar and context of the sentence.')} Use 'at' with a specific clock time."
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    if topic == "Article":
        question = "English Article: Choose the correct article in the sentence 'She is ___ honest officer who follows the rules.'"
        correct = "an"
        distractors = ["a", "the", "no article"]
        explanation = f"{ai_phrase('english', 'Articles depend on the sound and meaning of the noun phrase.')} Use 'an' before words beginning with a vowel sound such as 'honest'."
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    if topic == "Fill in the Blank":
        question = "English Fill in the Blank: Choose the best word to complete the sentence 'If the team ___ earlier, they would have caught the first train.'"
        correct = "had left"
        distractors = ["leave", "left", "was leaving"]
        explanation = f"{ai_phrase('english', 'Conditional sentences require the tense pattern that matches the situation.')} A third conditional sentence uses 'had + past participle' in the if-clause."
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    question = "English Tense: Choose the correct verb form in the sentence 'By the time the manager arrived, the staff ___ the report.'"
    correct = "had finished"
    distractors = ["finished", "have finished", "was finishing"]
    explanation = f"{ai_phrase('english', 'Tense questions should be solved by checking time order in the sentence.')} Past perfect is used for an action completed before another past action."
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_english_vocab(subject: str, topic: str, difficulty: str) -> Dict:
    if topic == "Vocabulary Antonym":
        question = "English Vocabulary Antonym: Choose the antonym of 'expand'."
        correct = "shrink"
        distractors = ["increase", "develop", "improve"]
        explanation = f"{ai_phrase('english', 'Vocabulary questions should be answered through meaning rather than surface form.')} 'Shrink' is the opposite of 'expand'."
        return build_row(question, correct, distractors, explanation, subject, topic, difficulty)

    question = "English Vocabulary Synonym: Choose the synonym of 'accurate'."
    correct = "precise"
    distractors = ["careless", "uncertain", "fragile"]
    explanation = f"{ai_phrase('english', 'Choose the word that preserves the original meaning most closely.')} 'Precise' has the closest meaning to 'accurate'."
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_english_reading(subject: str, topic: str, difficulty: str) -> Dict:
    passage = "The city library extended its opening hours and added online reservations, allowing more residents to borrow books conveniently after work."
    question = f"English {topic}: Read the passage '{passage}' What is the main benefit mentioned in the passage?"
    correct = "Residents can access library services more conveniently."
    distractors = [
        "The library reduced the number of books available.",
        "Residents must visit only in the morning.",
        "Online reservations were removed from the system.",
    ]
    explanation = f"{ai_phrase('english', 'Reading answers should come from the passage details and main idea.')} The passage highlights convenience through longer hours and online reservations."
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


def generate_law(subject: str, topic: str, difficulty: str) -> Dict:
    acts = list(LAW_CONCEPTS.keys())
    selected = topic if topic in LAW_CONCEPTS else random.choice(acts)
    concept = random.choice(LAW_CONCEPTS[selected])
    mode = random.choice(["identify_act", "identify_concept", "except_concept"])

    if mode == "identify_act":
        distractors = [act for act in acts if act != selected]
        random.shuffle(distractors)
        question = random.choice(LAW_APPLY_TEMPLATES).format(clue=concept)
        explanation = f"{ai_phrase('law', 'พิจารณาว่าคำสำคัญในสถานการณ์ตรงกับหลักของกฎหมายฉบับใดมากที่สุด')} ประเด็น '{concept}' เป็นสาระสำคัญของ {selected}"
        return build_row(question, selected, distractors[:3], explanation, subject, topic, difficulty)

    if mode == "identify_concept":
        question = random.choice(LAW_CONCEPT_TEMPLATES).format(act=selected)
        distractors = sample_other_law_concepts(selected, 3)
        explanation = f"{ai_phrase('law', 'ให้มองหาหลักการที่อยู่ในขอบเขตของกฎหมายฉบับนี้โดยตรง')} '{concept}' อยู่ในสาระสำคัญของ {selected}"
        return build_row(question, concept, distractors, explanation, subject, topic, difficulty)

    own_pool = [item for item in LAW_CONCEPTS[selected] if normalize(item) != normalize(concept)]
    foreign = sample_other_law_concepts(selected, 1)
    incorrect = foreign[0] if foreign else random.choice(sample_other_law_concepts(selected, 3))
    choices = unique_distractors(incorrect, own_pool + sample_other_law_concepts(selected, 2), 3)
    question = random.choice(LAW_EXCEPT_TEMPLATES).format(act=selected)
    explanation = f"{ai_phrase('law', 'ข้อยกเว้นต้องหาตัวเลือกที่อยู่นอกขอบเขตของกฎหมายฉบับนั้น')} '{incorrect}' ไม่ใช่สาระหลักของ {selected}"
    return build_row(question, incorrect, choices, explanation, subject, topic, difficulty)


def generate_generic(subject: str, topic: str, difficulty: str) -> Dict:
    question = f"ข้อสอบหัวข้อ {topic}: ข้อใดอธิบายสาระสำคัญของหัวข้อนี้ได้เหมาะสมที่สุดในบริบทของวิชา {subject}?"
    correct = f"คำตอบที่สอดคล้องกับหลักของหัวข้อ {topic} มากที่สุด"
    distractors = [
        "คำตอบที่ขัดกับเงื่อนไขหลักของโจทย์",
        "คำตอบที่ไม่สัมพันธ์กับข้อมูลที่โจทย์กำหนด",
        "คำตอบที่กล่าวกว้างเกินไปจนไม่ตอบคำถาม",
    ]
    explanation = f"{ai_phrase('analytical', 'คำตอบที่ดีต้องอิงหลักของโจทย์และข้อมูลที่ให้มาอย่างตรงไปตรงมา')} คำตอบที่ถูกต้องต้องสอดคล้องกับแนวคิดหลักของหัวข้อ {topic} และใช้ข้อมูลจากโจทย์โดยตรง"
    return build_row(question, correct, distractors, explanation, subject, topic, difficulty)


PROFILE_GENERATORS: Dict[str, Callable[[str, str, str], Dict]] = {
    "percentage": generate_percentage,
    "ratio": generate_ratio,
    "equation": generate_equation,
    "speed": generate_speed,
    "comparison": generate_comparison,
    "table": generate_table,
    "sequence": generate_sequence,
    "logic": generate_logic,
    "thai_reading": generate_thai_reading,
    "thai_word": generate_thai_word,
    "thai_vocab": generate_thai_vocab,
    "english_grammar": generate_english_grammar,
    "english_vocab": generate_english_vocab,
    "english_reading": generate_english_reading,
    "law": generate_law,
}


def generate_questions(subject: str, topic: str, difficulty: str, count: int) -> List[Dict]:
    profile = resolve_profile(subject, topic)
    generator = PROFILE_GENERATORS.get(profile, generate_generic)
    rows: List[Dict] = []
    seen = set()
    attempts = 0
    max_attempts = max(30, count * 6)

    while len(rows) < count and attempts < max_attempts:
        attempts += 1
        row = generator(subject, topic, difficulty)
        stem_key = normalize(row["question"])
        if stem_key in seen:
            continue
        seen.add(stem_key)
        rows.append(row)

    while len(rows) < count:
        rows.append(generate_generic(subject, topic, difficulty))
    return rows[:count]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    subject = payload.get("subject") or payload.get("category") or "Analytical Thinking"
    topic = payload.get("topic") or payload.get("subcategory") or "Tables"
    difficulty = payload.get("difficulty") or "medium"
    count = int(payload.get("count") or 5)

    rows = generate_questions(subject, topic, difficulty, count)
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
