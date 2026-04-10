from __future__ import annotations

import json
import os
import sys
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

if __package__ in {None, ""}:
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from .duplicate import is_duplicate, max_similarity
    from .generator import generate_questions
    from .topic_classifier import classify_topic, topic_matches
    from .validator import validate_question
except ImportError:
    try:
        from ai_engine.duplicate import is_duplicate, max_similarity
        from ai_engine.generator import generate_questions
        from ai_engine.topic_classifier import classify_topic, topic_matches
        from ai_engine.validator import validate_question
    except ImportError:
        from duplicate import is_duplicate, max_similarity
        from generator import generate_questions
        from topic_classifier import classify_topic, topic_matches
        from validator import validate_question


app = FastAPI(title="Exam AI Engine", version="1.0.0")


class GeneratePayload(BaseModel):
    category: str
    subcategory: str
    difficulty: str = "medium"
    count: int = Field(default=1, ge=1)
    offset: int = Field(default=0, ge=0)


class TopicPayload(BaseModel):
    topic: str
    text: str


class DuplicatePayload(BaseModel):
    candidate: str
    existing: list[str] = Field(default_factory=list)
    threshold: float = 0.85


class ValidatePayload(BaseModel):
    topic: str | None = None
    question: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    correct_answer: str
    explanation: str = ""
    difficulty: str = "medium"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate")
def generate(payload: GeneratePayload) -> dict[str, Any]:
    questions = generate_questions(payload.model_dump())
    return {"questions": questions, "generated": len(questions)}


@app.post("/validate/topic")
def validate_topic(payload: TopicPayload) -> dict[str, Any]:
    predicted, score = classify_topic(payload.text)
    matches = topic_matches(payload.topic, payload.text)
    return {"matches": matches, "predicted_topic": predicted, "score": score}


@app.post("/validate/duplicate")
def validate_duplicate(payload: DuplicatePayload) -> dict[str, Any]:
    similarity = max_similarity(payload.candidate, payload.existing)
    return {"duplicate": similarity >= payload.threshold, "similarity": similarity}


@app.post("/validate/question")
def validate_shape(payload: ValidatePayload) -> dict[str, Any]:
    result = validate_question(payload.model_dump(), payload.topic)
    return {
        "valid": result.valid,
        "reason": result.reason,
        "quality_score": result.quality_score,
        "clarity": result.clarity,
        "topic_relevance": result.topic_relevance,
        "difficulty": result.difficulty,
        "answer_correctness": result.answer_correctness,
    }


def run_cli(command: str, payload: dict[str, Any]) -> dict[str, Any]:
    if command == "generate":
        questions = generate_questions(payload)
        return {"questions": questions, "generated": len(questions)}
    if command == "topic":
        predicted, score = classify_topic(payload.get("text", ""))
        return {"matches": topic_matches(payload.get("topic", ""), payload.get("text", "")), "predicted_topic": predicted, "score": score}
    if command == "duplicate":
        similarity = max_similarity(payload.get("candidate", ""), payload.get("existing", []))
        threshold = float(payload.get("threshold", 0.85))
        return {"duplicate": similarity >= threshold, "similarity": similarity}
    if command == "validate":
        result = validate_question(payload, payload.get("topic"))
        return {
            "valid": result.valid,
            "reason": result.reason,
            "quality_score": result.quality_score,
            "clarity": result.clarity,
            "topic_relevance": result.topic_relevance,
            "difficulty": result.difficulty,
            "answer_correctness": result.answer_correctness,
        }
    raise ValueError(f"Unknown command: {command}")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "generate"
    payload = json.load(sys.stdin)
    print(json.dumps(run_cli(command, payload), ensure_ascii=False))