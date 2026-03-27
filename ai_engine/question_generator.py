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
    AutoTokenizer = None

try:
    from huggingface_hub import InferenceClient
except Exception as exc:
    print(f"huggingface_hub import failed: {exc}", file=sys.stderr)
    sys.exit(1)

from generator import generate_questions
        f"[{topic}] หากต้องเลือกข้อความที่ตรงประเด็นที่สุด ควรเลือกข้อใด?",
if __name__ == '__main__':
    import json
    import sys

    payload = json.load(sys.stdin)
    print(json.dumps(generate_questions(payload), ensure_ascii=False))
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
