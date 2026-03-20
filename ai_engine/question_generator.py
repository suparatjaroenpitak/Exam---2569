#!/usr/bin/env python3
import sys
import json
import random
from typing import List, Dict

def pct_templates(count:int, difficulty:str) -> List[Dict]:
    templates = []
    # five styles for ร้อยละ
    # 1. เปอร์เซ็นต์ของจำนวน
    a = random.randint(10, 90)
    b = random.choice([50,100,200,400])
    q = f"ร้อยละ {a} ของ {b} มีค่าเท่าใด?"
    correct = str(round(b * a / 100,2)).rstrip('0').rstrip('.')
    templates.append((q, correct, f"{a}% ของ {b} = {correct}"))

    # 2. เปอร์เซ็นต์เพิ่ม
    p = random.randint(5,30)
    val = random.randint(100,1000)
    q = f"จำนวนหนึ่งเพิ่มขึ้นร้อยละ {p} จาก {val} จะได้จำนวนเท่าใด?"
    correct = str(round(val*(1+p/100),2)).rstrip('0').rstrip('.')
    templates.append((q, correct, f"{val}*(1+{p/100}) = {correct}"))

    # 3. เปรียบเทียบเปอร์เซ็นต์
    x = random.randint(120,500)
    q = f"ร้อยละเท่าใดของ {x} เท่ากับ {int(x*0.25)}?"
    correct = "25%"
    templates.append((q, correct, "คำตอบคือ 25 เปอร์เซ็นต์"))

    # 4. คำนวณย้อนกลับ
    total = random.randint(50,200)
    part = random.randint(1,total-1)
    q = f"ถ้า {part} เป็นร้อยละเท่าใดของ {total}?"
    correct = str(round(part/total*100,2)).rstrip('0').rstrip('.')+"%"
    templates.append((q, correct, f"{part}/{total} = {correct}"))

    # 5. เปอร์เซ็นต์ลด
    p2 = random.randint(5,40)
    val2 = random.randint(200,2000)
    q = f"จำนวน {val2} ลดลงร้อยละ {p2} จะเหลือเท่าใด?"
    correct = str(round(val2*(1-p2/100),2)).rstrip('0').rstrip('.')
    templates.append((q, correct, f"{val2}*(1-{p2/100}) = {correct}"))

    # expand to requested count with variations
    out = []
    idx = 0
    while len(out) < count:
        t = templates[idx % len(templates)]
        q, correct, expl = t
        # vary wording slightly
        if idx % 2 == 0:
            q2 = q
        else:
            q2 = q.replace("ร้อยละ", "เปอร์เซ็นต์")
        choices = generate_choices_for_answer(correct)
        out.append({
            "question": q2,
            "choice_a": choices[0],
            "choice_b": choices[1],
            "choice_c": choices[2],
            "choice_d": choices[3],
            "correct_answer": choice_letter_for(choices, correct),
            "explanation": expl,
            "subject": "Analytical Thinking",
            "topic": "ร้อยละ",
            "difficulty": difficulty
        })
        idx += 1
    return out

def generate_choices_for_answer(correct:str) -> List[str]:
    # produce plausible distractors numerically when possible
    def try_num(s):
        try:
            return float(s.replace('%',''))
        except:
            return None

    num = try_num(correct)
    choices = []
    if num is not None:
        base = num
        # produce 3 distractors
        deltas = [(-10, -5), (-3, -1), (1, 5), (5,10)]
        opts = set()
        opts.add(format_numeric_choice(base))
        attempts = 0
        while len(opts) < 4 and attempts < 50:
            d = random.choice([ -5, -3, -2, 2, 3, 5, 10 ])
            candidate = base + d
            opts.add(format_numeric_choice(candidate))
            attempts += 1
        choices = list(opts)
        # ensure length 4
        while len(choices) < 4:
            choices.append(str(int(base)+random.randint(1,15)))
        random.shuffle(choices)
        return choices[:4]

    # fallback textual choices
    pool = ["มากกว่า", "น้อยกว่า", "เท่ากับ", "ใกล้เคียง"]
    random.shuffle(pool)
    return pool[:4]

def format_numeric_choice(val):
    if abs(val - int(val)) < 1e-8:
        return str(int(val))
    else:
        s = str(round(val,2)).rstrip('0').rstrip('.')
        if '%' in s:
            return s
        return s

def choice_letter_for(choices:list, correct_raw:str) -> str:
    # match numeric or substring
    for i,c in enumerate(choices):
        if normalize(c) == normalize(correct_raw) or normalize(correct_raw) in normalize(c):
            return "ABCD"[i]
    # fallback first
    return "ABCD"[choices.index(choices[0])] if choices else "A"

def normalize(s:str) -> str:
    return str(s).replace('%','').strip().lower()

def main():
    try:
        inp = json.load(sys.stdin)
    except Exception:
        inp = {}
    subject = inp.get('subject') or inp.get('category') or 'Analytical Thinking'
    topic = inp.get('topic') or inp.get('subcategory') or 'ร้อยละ'
    difficulty = inp.get('difficulty','medium')
    count = int(inp.get('count',5))

    out = []
    if topic == 'ร้อยละ':
        out = pct_templates(count,difficulty)
    else:
        # fallback simple templates for other topics
        for i in range(count):
            q = f"ตัวอย่างโจทย์สำหรับหัวข้อ {topic} ข้อที่ {i+1}"
            choices = [f"ตัวเลือก {j}" for j in ['A','B','C','D']]
            out.append({
                'question': q,
                'choice_a': choices[0],
                'choice_b': choices[1],
                'choice_c': choices[2],
                'choice_d': choices[3],
                'correct_answer': 'A',
                'explanation': 'ตัวอย่างคำอธิบาย',
                'subject': subject,
                'topic': topic,
                'difficulty': difficulty
            })

    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
