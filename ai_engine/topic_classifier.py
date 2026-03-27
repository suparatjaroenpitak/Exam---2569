from __future__ import annotations

from collections import Counter
from typing import Iterable

from pythainlp.corpus.common import thai_stopwords
from pythainlp.tokenize import sent_tokenize, word_tokenize
from pythainlp.util import normalize


LAW_TOPIC_MAP = {
    "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": ["ระเบียบบริหารราชการแผ่นดิน", "2534", "ส่วนราชการ", "อำนาจหน้าที่"],
    "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": ["กิจการบ้านเมืองที่ดี", "2546", "ประโยชน์สุข", "ประชาชน"],
    "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": ["ราชการทางปกครอง", "คำสั่งทางปกครอง", "คู่กรณี", "2539"],
    "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": ["ความผิดต่อตำแหน่ง", "เจ้าพนักงาน", "ป.อ.", "2499"],
    "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": ["ละเมิดของเจ้าหน้าที่", "ความรับผิด", "ไล่เบี้ย", "เจ้าหน้าที่"],
    "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": ["จริยธรรม", "มาตรฐานทางจริยธรรม", "2562", "คุณธรรม"]
}

TOPIC_KEYWORDS = {
    "Percentage": ["ร้อยละ", "เปอร์เซ็นต์", "percent", "%"],
    "Ratio": ["อัตราส่วน", "ratio"],
    "Proportion": ["สัดส่วน", "proportion"],
    "Equation": ["สมการ", "equation", "ค่า x", "2x"],
    "Speed Distance Time": ["อัตราเร็ว", "ระยะทาง", "เวลา", "speed", "distance", "time"],
    "Reading Comprehension": ["บทความ", "จับใจความ", "อ่าน"],
    "Summarize": ["สรุป", "ใจความสำคัญ", "summary"],
    "Interpretation": ["ตีความ", "interpret"],
    "Tense": ["tense", "verb"],
    "Preposition": ["preposition"],
    "Conjunction": ["conjunction"],
}
TOPIC_KEYWORDS.update(LAW_TOPIC_MAP)


def normalize_text(value: str) -> str:
    return " ".join(normalize(str(value or "")).strip().lower().split())


def split_sentences(text: str) -> list[str]:
    normalized = normalize_text(text)
    try:
        segments = sent_tokenize(normalized)
        return [segment for segment in segments if segment.strip()]
    except Exception:
        rough = normalized.replace("?", "\n").replace("!", "\n").replace(".", "\n")
        return [segment.strip() for segment in rough.splitlines() if segment.strip()]


def extract_keywords(text: str, limit: int = 8) -> list[str]:
    tokens: list[str] = []
    stopwords = thai_stopwords()
    for sentence in split_sentences(text):
        tokens.extend(word_tokenize(sentence, engine="newmm", keep_whitespace=False))
    filtered = [token for token in tokens if token and token not in stopwords and len(token.strip()) > 1]
    return [word for word, _count in Counter(filtered).most_common(limit)]


def _keyword_score(topic: str, text: str) -> float:
    normalized_text = normalize_text(text)
    keywords = TOPIC_KEYWORDS.get(topic, [])
    if not keywords:
        keywords = [topic, topic.replace(" ", "")]
    matches = sum(1 for keyword in keywords if normalize_text(keyword) in normalized_text)
    return matches / max(len(keywords), 1)


def classify_topic(text: str, allowed_topics: Iterable[str] | None = None) -> tuple[str | None, float]:
    topics = list(allowed_topics) if allowed_topics else list(TOPIC_KEYWORDS.keys())
    best_topic = None
    best_score = 0.0
    for topic in topics:
        score = _keyword_score(topic, text)
        if score > best_score:
            best_topic = topic
            best_score = score
    return best_topic, best_score


def topic_matches(topic: str, text: str, minimum_score: float = 0.2) -> bool:
    normalized_topic = normalize_text(topic)
    normalized_text = normalize_text(text)
    if not normalized_topic or not normalized_text:
        return False
    if normalized_topic in normalized_text or normalized_topic.replace(" ", "") in normalized_text:
        return True
    extracted = extract_keywords(text)
    if any(normalize_text(keyword) in normalized_text for keyword in TOPIC_KEYWORDS.get(topic, [])):
        return True
    score = _keyword_score(topic, " ".join(extracted + [text]))
    return score >= minimum_score


if __name__ == "__main__":
    import json
    import sys

    payload = json.load(sys.stdin)
    predicted, score = classify_topic(payload.get("text", ""))
    print(json.dumps({
        "matches": topic_matches(payload.get("topic", ""), payload.get("text", "")),
        "predicted_topic": predicted,
        "score": score,
    }, ensure_ascii=False))
