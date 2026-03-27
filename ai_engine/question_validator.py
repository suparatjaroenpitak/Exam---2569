from validator import validate_question

if __name__ == '__main__':
    import sys, json
    payload = json.load(sys.stdin)
    result = validate_question(payload, payload.get('topic'))
    print(json.dumps({'valid': result.valid, 'reason': result.reason, 'quality_score': result.quality_score}))
