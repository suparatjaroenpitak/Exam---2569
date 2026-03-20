from typing import Dict

TOPIC_TOKENS = {
    'ร้อยละ': ['ร้อยละ','เปอร์เซ็นต์','%'],
    'ตารางข้อมูล': ['ตาราง','ตารางข้อมูล','table'],
    'อนุกรม': ['อนุกรม','ลำดับ','sequence'],
    'ตรรกศาสตร์': ['ตรรกะ','ตรรกศาสตร์','logic']
}

def topic_matches(topic: str, text: str) -> bool:
    tokens = TOPIC_TOKENS.get(topic, [])
    lowered = text.lower()
    for t in tokens:
        if t in lowered:
            return True
    return False

if __name__ == '__main__':
    import sys,json
    p = json.load(sys.stdin)
    topic = p.get('topic')
    text = p.get('text','')
    print(json.dumps({'matches': topic_matches(topic,text)}))
