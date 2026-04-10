from __future__ import annotations

from dataclasses import dataclass

try:
    from .topic_classifier import topic_matches
except ImportError:
    from topic_classifier import topic_matches


@dataclass
class ValidationResult:
    valid: bool
    reason: str
    quality_score: int
    clarity: int
    topic_relevance: int
    difficulty: int
    answer_correctness: int


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def validate_choices(question: dict) -> tuple[bool, str]:
    values = [normalize_text(question.get(key, "")) for key in ("choice_a", "choice_b", "choice_c", "choice_d")]
    non_empty = [value for value in values if value]
    if len(non_empty) < 4:
        return False, "not enough choices"
    if len(set(value.lower() for value in non_empty)) != 4:
        return False, "duplicate choices"
    return True, "ok"


def compute_quality_score(question: dict, topic: str | None = None) -> ValidationResult:
    prompt = normalize_text(question.get("question", ""))
    explanation = normalize_text(question.get("explanation", ""))
    answer = normalize_text(question.get("correct_answer", "")).upper()
    choices = [normalize_text(question.get(key, "")) for key in ("choice_a", "choice_b", "choice_c", "choice_d")]

    clarity = 30 if len(prompt) >= 45 else 20 if len(prompt) >= 25 else 10
    if explanation:
        clarity += 10

    relevance = 25 if topic and topic_matches(topic, " ".join([prompt, explanation] + choices)) else 10
    difficulty = 20 if str(question.get("difficulty", "medium")) in {"easy", "medium", "hard"} else 8
    answer_correctness = 25 if answer in {"A", "B", "C", "D"} and choices["ABCD".index(answer)] else 0

    total = max(0, min(100, clarity + relevance + difficulty + answer_correctness))
    valid = total >= 70
    reason = "ok" if valid else "quality below threshold"
    return ValidationResult(valid=valid, reason=reason, quality_score=total, clarity=clarity, topic_relevance=relevance, difficulty=difficulty, answer_correctness=answer_correctness)


def validate_question(question: dict, topic: str | None = None) -> ValidationResult:
    prompt = normalize_text(question.get("question", ""))
    if len(prompt) < 15:
        return ValidationResult(False, "question too short", 0, 0, 0, 0, 0)

    choices_ok, reason = validate_choices(question)
    if not choices_ok:
        return ValidationResult(False, reason, 0, 0, 0, 0, 0)

    result = compute_quality_score(question, topic)
    if normalize_text(question.get("correct_answer", "")).upper() not in {"A", "B", "C", "D"}:
        return ValidationResult(False, "invalid correct answer", result.quality_score, result.clarity, result.topic_relevance, result.difficulty, 0)

    return result