from duplicate import is_duplicate, max_similarity, similarity

if __name__ == '__main__':
    import sys, json
    payload = json.load(sys.stdin)
    cand = payload.get('candidate', '')
    existing = payload.get('existing', [])
    th = payload.get('threshold', 0.85)
    print(json.dumps({'duplicate': is_duplicate(cand, existing, th), 'similarity': max_similarity(cand, existing)}))
