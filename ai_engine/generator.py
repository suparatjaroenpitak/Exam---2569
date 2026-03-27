from __future__ import annotations

import hashlib
import random
from collections import Counter
from typing import Any

from pythainlp.corpus.common import thai_stopwords
from pythainlp.tokenize import sent_tokenize, word_tokenize
from pythainlp.util import normalize


LAW_TOPICS = {
    "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": {
        "keywords": ["ส่วนราชการ", "อำนาจหน้าที่", "ราชการส่วนกลาง"],
        "fact": "กฎหมายฉบับนี้กำหนดโครงสร้างส่วนราชการและการแบ่งอำนาจหน้าที่อย่างชัดเจน"
    },
    "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": {
        "keywords": ["ประโยชน์สุข", "ประชาชน", "ประสิทธิภาพ"],
        "fact": "หลักสำคัญคือการบริหารเพื่อประโยชน์สุขของประชาชนและประสิทธิภาพของรัฐ"
    },
    "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": {
        "keywords": ["คำสั่งทางปกครอง", "คู่กรณี", "รับฟัง"],
        "fact": "เน้นขั้นตอนที่เป็นธรรมและการคุ้มครองสิทธิของคู่กรณีก่อนออกคำสั่งทางปกครอง"
    },
    "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": {
        "keywords": ["เจ้าพนักงาน", "ตำแหน่งหน้าที่", "มิชอบ"],
        "fact": "มุ่งป้องกันการใช้อำนาจหน้าที่โดยมิชอบของเจ้าพนักงาน"
    },
    "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": {
        "keywords": ["ละเมิด", "ไล่เบี้ย", "ชดใช้"],
        "fact": "รัฐรับผิดชดใช้แก่ผู้เสียหายก่อน และอาจไล่เบี้ยจากเจ้าหน้าที่เมื่อมีเหตุ"
    },
    "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": {
        "keywords": ["จริยธรรม", "คุณธรรม", "ผลประโยชน์ทับซ้อน"],
        "fact": "ข้าราชการต้องรักษามาตรฐานจริยธรรมและหลีกเลี่ยงผลประโยชน์ทับซ้อน"
    }
}


def normalize_text(value: Any) -> str:
    return " ".join(normalize(str(value or "")).strip().split())


def split_sentences(text: str) -> list[str]:
    normalized = normalize_text(text)
    try:
        segments = sent_tokenize(normalized)
        return [segment for segment in segments if segment.strip()]
    except Exception:
        rough = normalized.replace("?", "\n").replace("!", "\n").replace(".", "\n")
        return [segment.strip() for segment in rough.splitlines() if segment.strip()]


def stable_seed(*values: Any) -> int:
    joined = "::".join(normalize_text(value) for value in values)
    return int(hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16], 16)


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    stopwords = thai_stopwords()
    tokens: list[str] = []
    for sentence in split_sentences(text):
        tokens.extend(word_tokenize(sentence, engine="newmm", keep_whitespace=False))
    filtered = [token for token in tokens if token and token not in stopwords and len(token.strip()) > 1]
    return [word for word, _count in Counter(filtered).most_common(limit)]


def unique_choices(correct: str, distractors: list[str], rng: random.Random) -> tuple[list[str], str]:
    seen = set()
    choices: list[str] = []
    for value in [correct] + distractors:
        normalized = normalize_text(value).lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        choices.append(normalize_text(value))
        if len(choices) == 4:
            break
    while len(choices) < 4:
        filler = f"ตัวเลือกสำรอง {len(choices) + 1}"
        if filler.lower() not in seen:
            seen.add(filler.lower())
            choices.append(filler)
    rng.shuffle(choices)
    answer = "ABCD"[choices.index(normalize_text(correct))]
    return choices, answer


def analytical_question(topic: str, difficulty: str, index: int) -> dict[str, str]:
    rng = random.Random(stable_seed(topic, difficulty, index))
    topic_lower = topic.lower()
    if "percentage" in topic_lower or "ร้อยละ" in topic_lower or "เปอร์เซ็นต์" in topic_lower:
        base = rng.choice([200, 250, 320, 400, 500, 800])
        pct = rng.choice([10, 15, 20, 25, 30, 35])
        if index % 2 == 0:
            answer_value = int(base * pct / 100)
            prompt = f"ร้อยละ {pct} ของ {base} เท่ากับเท่าใด"
            explanation = f"นำ {base} คูณ {pct}/100 จะได้ {answer_value}"
        else:
            answer_value = int(base * (1 + pct / 100))
            prompt = f"จำนวน {base} เพิ่มขึ้น {pct}% จะเป็นเท่าใด"
            explanation = f"เพิ่มขึ้น {pct}% คือคูณด้วย 1.{pct:02d} จึงได้ {answer_value}"
        choices, answer = unique_choices(str(answer_value), [str(answer_value + delta) for delta in (-25, 15, 40, -10)], rng)
        return {
            "question": prompt,
            "choice_a": choices[0],
            "choice_b": choices[1],
            "choice_c": choices[2],
            "choice_d": choices[3],
            "correct_answer": answer,
            "explanation": explanation,
        }
    if "equation" in topic_lower or "สมการ" in topic_lower:
        x_value = rng.randint(3, 12)
        coefficient = rng.randint(2, 5)
        constant = rng.randint(3, 10)
        rhs = coefficient * x_value + constant
        prompt = f"ถ้า {coefficient}x + {constant} = {rhs} ค่า x เท่ากับเท่าใด"
        choices, answer = unique_choices(str(x_value), [str(x_value + delta) for delta in (-2, 1, 3, -4)], rng)
        return {
            "question": prompt,
            "choice_a": choices[0],
            "choice_b": choices[1],
            "choice_c": choices[2],
            "choice_d": choices[3],
            "correct_answer": answer,
            "explanation": f"ย้าย {constant} ไปอีกข้างจะได้ {coefficient}x = {rhs - constant} ดังนั้น x = {x_value}",
        }
    if "ratio" in topic_lower or "อัตราส่วน" in topic_lower or "proportion" in topic_lower or "สัดส่วน" in topic_lower:
        left = rng.randint(2, 7)
        right = rng.randint(3, 9)
        multiplier = rng.randint(4, 10)
        answer_value = right * multiplier
        prompt = f"อัตราส่วนของชายต่อหญิงเป็น {left}:{right} ถ้ามีชาย {left * multiplier} คน จะมีหญิงกี่คน"
        choices, answer = unique_choices(str(answer_value), [str(answer_value + delta) for delta in (-left, right, multiplier, 2 * left)], rng)
        return {
            "question": prompt,
            "choice_a": choices[0],
            "choice_b": choices[1],
            "choice_c": choices[2],
            "choice_d": choices[3],
            "correct_answer": answer,
            "explanation": f"เมื่อคูณอัตราส่วนด้วย {multiplier} จะได้หญิง {answer_value} คน",
        }

    base = rng.randint(40, 120)
    step = rng.randint(6, 20)
    answer_value = base + step
    prompt = f"[{topic}] หากค่าตั้งต้นเท่ากับ {base} และเพิ่มขึ้นอีก {step} หน่วย คำตอบที่ถูกต้องคือข้อใด"
    choices, answer = unique_choices(str(answer_value), [str(answer_value + delta) for delta in (-6, 4, 12, -10)], rng)
    return {
        "question": prompt,
        "choice_a": choices[0],
        "choice_b": choices[1],
        "choice_c": choices[2],
        "choice_d": choices[3],
        "correct_answer": answer,
        "explanation": f"คำนวณจากค่าตั้งต้น {base} บวก {step} จะได้ {answer_value}",
    }


def law_question(topic: str, difficulty: str, index: int) -> dict[str, str]:
    rng = random.Random(stable_seed(topic, difficulty, index))
    details = LAW_TOPICS.get(topic, {"keywords": extract_keywords(topic), "fact": f"หัวข้อ {topic} เน้นการปฏิบัติราชการให้ถูกต้องตามกฎหมาย"})
    keyword = rng.choice(details["keywords"] or [topic])
    prompt = f"[{topic}] หากหน่วยงานของรัฐต้องตัดสินใจเกี่ยวกับเรื่อง {keyword} ข้อใดสอดคล้องกับหลักการของกฎหมายนี้มากที่สุด"
    correct = details["fact"]
    distractors = [
        "ใช้อำนาจตามดุลพินิจโดยไม่ต้องอธิบายเหตุผลแก่ผู้เกี่ยวข้อง",
        "ลดขั้นตอนที่กฎหมายกำหนดแม้อาจกระทบสิทธิของประชาชน",
        "พิจารณาเฉพาะความสะดวกของเจ้าหน้าที่โดยไม่คำนึงถึงหลักกฎหมาย",
        "ตีความให้กว้างเกินบทบัญญัติเพื่อเร่งผลลัพธ์ของหน่วยงาน",
    ]
    choices, answer = unique_choices(correct, distractors, rng)
    return {
        "question": prompt,
        "choice_a": choices[0],
        "choice_b": choices[1],
        "choice_c": choices[2],
        "choice_d": choices[3],
        "correct_answer": answer,
        "explanation": correct,
    }


def language_question(subject: str, topic: str, difficulty: str, index: int) -> dict[str, str]:
    rng = random.Random(stable_seed(subject, topic, difficulty, index))
    keywords = extract_keywords(topic) or [topic]
    focus = keywords[0]
    if subject == "English Language":
        prompt = f"[{topic}] Choose the option that best matches the grammar target for {focus}."
        correct = f"It follows the correct {topic.lower()} pattern."
        distractors = [
            "It breaks the grammar rule in the sentence.",
            "It changes the intended meaning of the sentence.",
            "It does not fit the context of the prompt.",
        ]
        explanation = f"The correct option satisfies the grammar condition required by {topic}."
    else:
        prompt = f"[{topic}] ข้อใดใช้ภาษาได้ตรงตามหลักของหัวข้อ {focus} มากที่สุด"
        correct = f"ข้อความนี้สอดคล้องกับหลักของหัวข้อ {topic} และตอบโจทย์ได้ตรงประเด็น"
        distractors = [
            "ข้อความนี้คลุมเครือและสื่อความไม่ตรงประเด็น",
            "ข้อความนี้ใช้ถ้อยคำไม่เหมาะสมกับบริบทของโจทย์",
            "ข้อความนี้สรุปเกินกว่าข้อมูลที่กำหนดในโจทย์",
        ]
        explanation = f"ตัวเลือกที่ถูกต้องสอดคล้องกับหลักภาษาในหัวข้อ {topic} มากที่สุด"
    choices, answer = unique_choices(correct, distractors, rng)
    return {
        "question": prompt,
        "choice_a": choices[0],
        "choice_b": choices[1],
        "choice_c": choices[2],
        "choice_d": choices[3],
        "correct_answer": answer,
        "explanation": explanation,
    }


def rule_based_question(subject: str, topic: str, difficulty: str, index: int) -> dict[str, str]:
    if subject == "Government Law & Ethics":
        return law_question(topic, difficulty, index)
    if subject in {"Thai Language", "English Language"}:
        return language_question(subject, topic, difficulty, index)
    return analytical_question(topic, difficulty, index)


def transformer_candidates(subject: str, topic: str, difficulty: str, count: int) -> list[dict[str, str]]:
    return []


def generate_questions(payload: dict[str, Any]) -> list[dict[str, str]]:
    subject = normalize_text(payload.get("category") or payload.get("subject") or "Analytical Thinking")
    topic = normalize_text(payload.get("subcategory") or payload.get("topic") or "Percentage")
    difficulty = normalize_text(payload.get("difficulty") or "medium") or "medium"
    count = max(1, int(payload.get("count") or 1))
    offset = max(0, int(payload.get("offset") or 0))

    items: list[dict[str, str]] = []
    seen = set()

    for index in range(offset, offset + count * 3):
        row = rule_based_question(subject, topic, difficulty, index)
        key = normalize_text(row["question"]).lower()
        if key in seen:
            continue
        seen.add(key)
        items.append({
            "subject": subject,
            "category": subject,
            "subcategory": topic,
            "difficulty": difficulty,
            "source": "python-rule",
            "generation_mode": "rule-based",
            **row,
        })
        if len(items) >= count:
            break

    if len(items) < count:
        for row in transformer_candidates(subject, topic, difficulty, count - len(items)):
            key = normalize_text(row["question"]).lower()
            if key in seen:
                continue
            seen.add(key)
            items.append({
                "subject": subject,
                "category": subject,
                "subcategory": topic,
                "difficulty": difficulty,
                "source": "python-transformer",
                "generation_mode": "transformer-fallback",
                **row,
            })
            if len(items) >= count:
                break

    while len(items) < count:
        index = offset + len(items) + count
        row = rule_based_question(subject, topic, difficulty, index)
        row["question"] = f"{row['question']} ชุดที่ {index + 1}"
        items.append({
            "subject": subject,
            "category": subject,
            "subcategory": topic,
            "difficulty": difficulty,
            "source": "python-rule",
            "generation_mode": "fallback-template",
            **row,
        })

    return items[:count]