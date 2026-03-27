from __future__ import annotations

from typing import Iterable

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except Exception:
    TfidfVectorizer = None
    cosine_similarity = None


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _fallback_similarity(left: str, right: str) -> float:
    left_tokens = set(normalize_text(left).split())
    right_tokens = set(normalize_text(right).split())
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def similarity(left: str, right: str) -> float:
    left_normalized = normalize_text(left)
    right_normalized = normalize_text(right)
    if not left_normalized or not right_normalized:
        return 0.0

    if TfidfVectorizer is None or cosine_similarity is None:
      return _fallback_similarity(left_normalized, right_normalized)

    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
    matrix = vectorizer.fit_transform([left_normalized, right_normalized])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])


def max_similarity(candidate: str, existing: Iterable[str]) -> float:
    best = 0.0
    for row in existing:
        best = max(best, similarity(candidate, row))
    return best


def is_duplicate(candidate: str, existing: Iterable[str], threshold: float = 0.85) -> bool:
    return max_similarity(candidate, existing) >= threshold