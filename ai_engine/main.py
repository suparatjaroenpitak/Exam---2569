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


# Ollama integration (optional - connect to Ollama on Colab)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:2b")
ENABLE_OLLAMA = os.environ.get("ENABLE_OLLAMA", "0") == "1"


def call_ollama(prompt: str, temperature: float = 0.8, max_tokens: int = 4096) -> dict[str, Any] | None:
    if not OLLAMA_BASE_URL:
        return None
    import requests
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens}
            },
            timeout=120
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"Ollama call failed: {exc}", file=sys.stderr)
        return None


def ollama_generate_questions(subject: str, topic: str, difficulty: str, count: int) -> list[dict[str, str]]:
    prompt = (
        f"You are an expert Thai civil service exam author. "
        f"Create {count} unique multiple-choice questions in Thai for category '{subject}' "
        f"and subcategory '{topic}' at '{difficulty}' difficulty.\n"
        "Each question must have 4 choices (choice_a, choice_b, choice_c, choice_d) "
        "and one correct_answer (A/B/C/D). Include an explanation.\n"
        "Return ONLY valid JSON array, no markdown.\n"
        'Example: [{"question":"...","choice_a":"...","choice_b":"...","choice_c":"...","choice_d":"...","correct_answer":"A","explanation":"..."}]'
    )
    result = call_ollama(prompt, temperature=0.85, max_tokens=max(2048, count * 300))
    if not result:
        return []
    content = (result.get("message") or {}).get("content") or result.get("response", "")
    if not content:
        return []
    try:
        import re
        json_match = re.search(r"\[[\s\S]*\]", content)
        if json_match:
            rows = json.loads(json_match.group())
            if isinstance(rows, list):
                return rows[:count]
    except (json.JSONDecodeError, Exception):
        pass
    return []


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
    data = payload.model_dump()
    questions = generate_questions(data)
    # If rule-based generator produced few questions and Ollama is configured, supplement
    if ENABLE_OLLAMA and len(questions) < data.get("count", 1):
        needed = data.get("count", 1) - len(questions)
        ollama_rows = ollama_generate_questions(
            data.get("category", ""), data.get("subcategory", ""),
            data.get("difficulty", "medium"), needed
        )
        for row in ollama_rows:
            if isinstance(row, dict) and row.get("question"):
                row["source"] = "ollama"
                row["generation_mode"] = "ollama-ai"
                questions.append(row)
    return {"questions": questions, "generated": len(questions)}


@app.post("/generate/ollama")
def generate_ollama(payload: GeneratePayload) -> dict[str, Any]:
    data = payload.model_dump()
    questions = ollama_generate_questions(
        data.get("category", ""), data.get("subcategory", ""),
        data.get("difficulty", "medium"), data.get("count", 1)
    )
    for q in questions:
        q["source"] = "ollama"
        q["generation_mode"] = "ollama-ai"
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
        if ENABLE_OLLAMA and len(questions) < payload.get("count", 1):
            needed = payload.get("count", 1) - len(questions)
            ollama_rows = ollama_generate_questions(
                payload.get("category", ""), payload.get("subcategory", ""),
                payload.get("difficulty", "medium"), needed
            )
            for row in ollama_rows:
                if isinstance(row, dict) and row.get("question"):
                    row["source"] = "ollama"
                    row["generation_mode"] = "ollama-ai"
                    questions.append(row)
        return {"questions": questions, "generated": len(questions)}
    if command == "ollama-generate":
        questions = ollama_generate_questions(
            payload.get("category", ""), payload.get("subcategory", ""),
            payload.get("difficulty", "medium"), payload.get("count", 1)
        )
        for q in questions:
            q["source"] = "ollama"
            q["generation_mode"] = "ollama-ai"
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
    sys.stdout.reconfigure(encoding="utf-8")
    command = sys.argv[1] if len(sys.argv) > 1 else "generate"
    payload = json.load(sys.stdin)
    print(json.dumps(run_cli(command, payload), ensure_ascii=False))