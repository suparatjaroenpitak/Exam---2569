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
        "facts": [
            "กฎหมายฉบับนี้กำหนดโครงสร้างส่วนราชการและการแบ่งอำนาจหน้าที่อย่างชัดเจน",
            "หลักสำคัญคือการจัดระเบียบราชการส่วนกลาง ส่วนภูมิภาค และส่วนท้องถิ่นให้มีขอบเขตอำนาจหน้าที่ชัดเจน",
            "การบริหารราชการต้องยึดโครงสร้างและสายบังคับบัญชาที่กฎหมายกำหนดไว้อย่างเป็นระบบ"
        ]
    },
    "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": {
        "keywords": ["ประโยชน์สุข", "ประชาชน", "ประสิทธิภาพ"],
        "facts": [
            "หลักสำคัญคือการบริหารเพื่อประโยชน์สุขของประชาชนและประสิทธิภาพของรัฐ",
            "หน่วยงานของรัฐต้องปรับปรุงวิธีทำงานให้เกิดความคุ้มค่าและตอบสนองประชาชนได้รวดเร็วขึ้น",
            "การบริหารกิจการบ้านเมืองที่ดีเน้นผลสัมฤทธิ์ ความคุ้มค่า และการอำนวยความสะดวกแก่ประชาชน"
        ]
    },
    "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": {
        "keywords": ["คำสั่งทางปกครอง", "คู่กรณี", "รับฟัง"],
        "facts": [
            "เน้นขั้นตอนที่เป็นธรรมและการคุ้มครองสิทธิของคู่กรณีก่อนออกคำสั่งทางปกครอง",
            "ก่อนมีคำสั่งทางปกครองที่กระทบสิทธิ ต้องเปิดโอกาสให้คู่กรณีได้รับทราบข้อเท็จจริงและแสดงพยานหลักฐาน",
            "หัวใจของกฎหมายนี้คือความเป็นธรรมทางปกครองและการให้เหตุผลประกอบคำสั่งอย่างเหมาะสม"
        ]
    },
    "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": {
        "keywords": ["เจ้าพนักงาน", "ตำแหน่งหน้าที่", "มิชอบ"],
        "facts": [
            "มุ่งป้องกันการใช้อำนาจหน้าที่โดยมิชอบของเจ้าพนักงาน",
            "กฎหมายส่วนนี้คุ้มครองความสุจริตในการใช้อำนาจรัฐและลงโทษการแสวงหาประโยชน์โดยมิชอบ",
            "การปฏิบัติหน้าที่ของเจ้าพนักงานต้องไม่ขัดต่อกฎหมายหรือเอื้อประโยชน์โดยมิชอบแก่ตนเองหรือผู้อื่น"
        ]
    },
    "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": {
        "keywords": ["ละเมิด", "ไล่เบี้ย", "ชดใช้"],
        "facts": [
            "รัฐรับผิดชดใช้แก่ผู้เสียหายก่อน และอาจไล่เบี้ยจากเจ้าหน้าที่เมื่อมีเหตุ",
            "เมื่อเจ้าหน้าที่กระทำละเมิดในการปฏิบัติหน้าที่ ผู้เสียหายมีสิทธิเรียกร้องจากรัฐตามหลักเกณฑ์ที่กฎหมายกำหนด",
            "การไล่เบี้ยจากเจ้าหน้าที่จะพิจารณาจากพฤติการณ์และระดับความร้ายแรงของการกระทำ"
        ]
    },
    "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": {
        "keywords": ["จริยธรรม", "คุณธรรม", "ผลประโยชน์ทับซ้อน"],
        "facts": [
            "ข้าราชการต้องรักษามาตรฐานจริยธรรมและหลีกเลี่ยงผลประโยชน์ทับซ้อน",
            "ผู้ดำรงตำแหน่งของรัฐต้องยึดความซื่อสัตย์สุจริตและคำนึงถึงประโยชน์ส่วนรวมเป็นสำคัญ",
            "การปฏิบัติราชการต้องเป็นธรรม โปร่งใส และไม่ใช้ตำแหน่งหน้าที่เพื่อแสวงหาประโยชน์ส่วนตน"
        ]
    }
}

GENERIC_DISTRACTORS = [
    "ใช้อำนาจตามดุลพินิจโดยไม่ต้องอธิบายเหตุผลแก่ผู้เกี่ยวข้อง",
    "ลดขั้นตอนที่กฎหมายกำหนดแม้อาจกระทบสิทธิของประชาชน",
    "พิจารณาเฉพาะความสะดวกของเจ้าหน้าที่โดยไม่คำนึงถึงหลักกฎหมาย",
    "ตีความให้กว้างเกินบทบัญญัติเพื่อเร่งผลลัพธ์ของหน่วยงาน",
    "ใช้แนวปฏิบัติภายในแทนหลักเกณฑ์ตามกฎหมายแม้มีผลกระทบต่อประชาชน",
    "มุ่งผลลัพธ์ระยะสั้นของหน่วยงานโดยไม่พิจารณาความชอบด้วยกฎหมาย"
]


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


def numeric_distractors(answer_value: int, rng: random.Random, minimum_gap: int = 3) -> list[str]:
    candidates = {
        answer_value + rng.randint(minimum_gap, minimum_gap + 8),
        answer_value - rng.randint(minimum_gap, minimum_gap + 8),
        answer_value + rng.randint(minimum_gap + 5, minimum_gap + 15),
        max(1, answer_value - rng.randint(minimum_gap + 5, minimum_gap + 15)),
        answer_value + rng.randint(1, 3) * max(minimum_gap, 2)
    }
    candidates.discard(answer_value)
    ordered = list(candidates)
    rng.shuffle(ordered)
    return [str(value) for value in ordered]


def analytical_question(topic: str, difficulty: str, index: int) -> dict[str, str]:
    rng = random.Random(stable_seed(topic, difficulty, index))
    topic_lower = topic.lower()
    if "percentage" in topic_lower or "ร้อยละ" in topic_lower or "เปอร์เซ็นต์" in topic_lower:
        base = rng.choice([200, 250, 320, 400, 500, 800])
        pct = rng.choice([10, 15, 20, 25, 30, 35])
        if index % 2 == 0:
            answer_value = int(base * pct / 100)
            prompt = rng.choice([
                f"ร้อยละ {pct} ของ {base} เท่ากับเท่าใด",
                f"ถ้าคิด {pct}% ของจำนวน {base} จะได้ค่าเท่าใด",
                f"จำนวน {base} เมื่อนำมาหา {pct} เปอร์เซ็นต์ จะได้ผลลัพธ์เท่าใด"
            ])
            explanation = f"นำ {base} คูณ {pct}/100 จะได้ {answer_value}"
        else:
            answer_value = int(base * (1 + pct / 100))
            prompt = rng.choice([
                f"จำนวน {base} เพิ่มขึ้น {pct}% จะเป็นเท่าใด",
                f"ถ้าค่าเริ่มต้น {base} เพิ่มขึ้นอีกร้อยละ {pct} ค่าที่ได้คือเท่าใด",
                f"เมื่อปรับจำนวน {base} เพิ่มขึ้น {pct} เปอร์เซ็นต์ ผลลัพธ์ที่ถูกต้องคือข้อใด"
            ])
            explanation = f"เพิ่มขึ้น {pct}% คือคูณด้วย 1.{pct:02d} จึงได้ {answer_value}"
        choices, answer = unique_choices(str(answer_value), numeric_distractors(answer_value, rng, 8), rng)
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
        prompt = rng.choice([
            f"ถ้า {coefficient}x + {constant} = {rhs} ค่า x เท่ากับเท่าใด",
            f"จากสมการ {coefficient}x + {constant} = {rhs} ตัวแปร x มีค่าเท่าใด",
            f"จงหาค่า x เมื่อ {coefficient}x + {constant} = {rhs}"
        ])
        choices, answer = unique_choices(str(x_value), numeric_distractors(x_value, rng, 1), rng)
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
        prompt = rng.choice([
            f"อัตราส่วนของชายต่อหญิงเป็น {left}:{right} ถ้ามีชาย {left * multiplier} คน จะมีหญิงกี่คน",
            f"ถ้าอัตราส่วนเป็น {left}:{right} และจำนวนส่วนแรกมี {left * multiplier} หน่วย จำนวนส่วนหลังจะเป็นเท่าใด",
            f"กำหนดอัตราส่วน {left}:{right} เมื่อฝั่งซ้ายมี {left * multiplier} คน ฝั่งขวาจะมีกี่คน"
        ])
        choices, answer = unique_choices(str(answer_value), numeric_distractors(answer_value, rng, max(2, left)), rng)
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
    choices, answer = unique_choices(str(answer_value), numeric_distractors(answer_value, rng, 4), rng)
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
    details = LAW_TOPICS.get(topic, {"keywords": extract_keywords(topic), "facts": [f"หัวข้อ {topic} เน้นการปฏิบัติราชการให้ถูกต้องตามกฎหมาย"]})
    keyword = rng.choice(details["keywords"] or [topic])
    correct = rng.choice(details["facts"])
    prompt = rng.choice([
        f"[{topic}] หากหน่วยงานของรัฐต้องตัดสินใจเกี่ยวกับเรื่อง {keyword} ข้อใดสอดคล้องกับหลักการของกฎหมายนี้มากที่สุด",
        f"[{topic}] ในสถานการณ์ที่เกี่ยวข้องกับ {keyword} หน่วยงานของรัฐควรยึดแนวทางใดจึงจะถูกต้องตามหลักกฎหมาย",
        f"[{topic}] หากเจ้าหน้าที่ต้องพิจารณาเรื่อง {keyword} ข้อใดสะท้อนการปฏิบัติที่เหมาะสมที่สุด",
        f"[{topic}] เมื่อเกิดประเด็นเกี่ยวกับ {keyword} ทางเลือกใดสอดคล้องกับเจตนารมณ์ของกฎหมายฉบับนี้มากที่สุด"
    ])
    distractors = [choice for choice in GENERIC_DISTRACTORS if choice != correct]
    other_topic_facts = [
        fact
        for other_topic, other_details in LAW_TOPICS.items()
        if other_topic != topic
        for fact in other_details["facts"]
    ]
    rng.shuffle(distractors)
    rng.shuffle(other_topic_facts)
    distractors = distractors[:2] + other_topic_facts[:2]
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
        prompt = rng.choice([
            f"[{topic}] Choose the option that best matches the grammar target for {focus}.",
            f"[{topic}] Which option uses {focus} correctly in context?",
            f"[{topic}] Select the sentence that best satisfies the grammar requirement for {focus}."
        ])
        correct = rng.choice([
            f"It follows the correct {topic.lower()} pattern.",
            f"This sentence uses {focus} correctly and matches the grammar rule.",
            f"The structure is appropriate for the {topic.lower()} point being tested."
        ])
        distractors = rng.sample([
            "It breaks the grammar rule in the sentence.",
            "It changes the intended meaning of the sentence.",
            "It does not fit the context of the prompt.",
            "Its tense or connector usage is inconsistent with the requirement.",
            "It looks similar but does not satisfy the tested grammar point."
        ], k=4)
        explanation = f"The correct option satisfies the grammar condition required by {topic}."
    else:
        prompt = rng.choice([
            f"[{topic}] ข้อใดใช้ภาษาได้ตรงตามหลักของหัวข้อ {focus} มากที่สุด",
            f"[{topic}] หากต้องเลือกข้อความที่เหมาะสมกับหลักภาษาในหัวข้อนี้ที่สุด ควรเลือกข้อใด",
            f"[{topic}] ข้อใดสื่อความได้ถูกต้อง ชัดเจน และสอดคล้องกับหลักของหัวข้อนี้มากที่สุด"
        ])
        correct = rng.choice([
            f"ข้อความนี้สอดคล้องกับหลักของหัวข้อ {topic} และตอบโจทย์ได้ตรงประเด็น",
            f"ข้อความนี้ใช้ถ้อยคำได้เหมาะสม ชัดเจน และสอดคล้องกับหลักภาษาในหัวข้อ {topic}",
            f"ข้อความนี้เรียบเรียงได้ถูกต้องตามหลักของหัวข้อ {topic} และไม่ทำให้ความหมายคลาดเคลื่อน"
        ])
        distractors = rng.sample([
            "ข้อความนี้คลุมเครือและสื่อความไม่ตรงประเด็น",
            "ข้อความนี้ใช้ถ้อยคำไม่เหมาะสมกับบริบทของโจทย์",
            "ข้อความนี้สรุปเกินกว่าข้อมูลที่กำหนดในโจทย์",
            "ข้อความนี้มีโครงสร้างภาษาที่ทำให้ความหมายคลาดเคลื่อน",
            "ข้อความนี้เลือกใช้คำได้ไม่สัมพันธ์กับเจตนาของโจทย์"
        ], k=4)
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