import re
from typing import Dict

def choices_unique(choices: Dict[str,str]) -> bool:
    vals = [v.strip() for v in choices.values() if v]
    return len(set(vals)) == len(vals)

def validate_question_shape(q: Dict) -> (bool, str):
    if not isinstance(q.get('question',''), str) or len(q.get('question','').strip()) < 10:
        return False, 'question too short'
    choices = {k: q.get(k,'') for k in ['choice_a','choice_b','choice_c','choice_d']}
    if not choices_unique(choices):
        return False, 'duplicate choices'
    if q.get('correct_answer','') not in ['A','B','C','D']:
        return False, 'invalid correct answer'
    return True, 'ok'

if __name__ == '__main__':
    import sys, json
    payload = json.load(sys.stdin)
    ok, reason = validate_question_shape(payload)
    print(json.dumps({'valid': ok, 'reason': reason}))
