import math
from typing import List

def tokenize(text: str):
    return [t.lower() for t in text.split()]

def vectorize(tokens):
    freqs = {}
    for t in tokens:
        freqs[t] = freqs.get(t,0)+1
    return freqs

def cosine(a,b):
    # a,b dicts
    inter = 0
    for k,v in a.items():
        if k in b:
            inter += v * b[k]
    mag = math.sqrt(sum(v*v for v in a.values())) * math.sqrt(sum(v*v for v in b.values()))
    if mag == 0:
        return 0.0
    return inter / mag

def similarity(s1: str, s2: str) -> float:
    v1 = vectorize(tokenize(s1))
    v2 = vectorize(tokenize(s2))
    return cosine(v1,v2)

def is_duplicate(candidate: str, existing: List[str], threshold: float = 0.85):
    for e in existing:
        if similarity(candidate, e) >= threshold:
            return True
    return False

if __name__ == '__main__':
    import sys,json
    payload = json.load(sys.stdin)
    cand = payload.get('candidate','')
    existing = payload.get('existing', [])
    th = payload.get('threshold', 0.85)
    print(json.dumps({'duplicate': is_duplicate(cand, existing, th)}))
