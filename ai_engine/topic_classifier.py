TOPIC_TOKENS = {
    'Percentage': ['percentage', 'percent', 'ร้อยละ', 'เปอร์เซ็นต์', '%'],
    'Ratio': ['ratio', 'อัตราส่วน'],
    'Proportion': ['proportion', 'สัดส่วน'],
    'Equation': ['equation', 'สมการ', 'x =', 'ค่า x'],
    'Speed Distance Time': ['speed', 'distance', 'time', 'อัตราเร็ว', 'ระยะทาง', 'เวลา'],
    'Number Comparison': ['comparison', 'compare', 'เปรียบเทียบ', 'มากกว่า', 'น้อยกว่า'],
    'Data Tables': ['data table', 'tables', 'table', 'ตารางข้อมูล', 'ตาราง'],
    'Arithmetic Sequence': ['arithmetic sequence', 'sequence', 'ลำดับเลขคณิต', 'ลำดับ'],
    'Power Sequence': ['power sequence', 'sequence', 'ยกกำลัง', 'ลำดับ'],
    'Fraction Sequence': ['fraction sequence', 'sequence', 'เศษส่วน', 'ลำดับ'],
    'Mixed Sequence': ['mixed sequence', 'sequence', 'ผสม', 'ลำดับ'],
    'Multi-sequence': ['multi-sequence', 'sequence', 'หลายชุด', 'ลำดับ'],
    'Symbolic Conditions': ['symbolic', 'condition', 'สัญลักษณ์', 'เงื่อนไข'],
    'Language Conditions': ['language condition', 'เงื่อนไขทางภาษา', 'เงื่อนไข'],
    'Relationship Finding': ['relationship', 'ความสัมพันธ์'],
    'Logical Reasoning': ['logical reasoning', 'logic', 'ตรรกะ', 'เหตุผล'],
    'Odd-one-out': ['odd-one-out', 'แตกต่าง', 'เข้าพวก'],
    'Truth Tables': ['truth table', 'ตารางค่าความจริง', 'truth'],
    'Tables': ['tables', 'table', 'ตาราง'],
    'Graphs': ['graphs', 'graph', 'กราฟ'],
    'Charts': ['charts', 'chart', 'แผนภูมิ'],
    'Data Interpretation': ['data interpretation', 'ตีความข้อมูล', 'วิเคราะห์ข้อมูล', 'interpret'],
    'Reading Comprehension': ['reading comprehension', 'บทความ', 'อ่าน', 'จับใจความ'],
    'Analyze Article': ['analyze article', 'วิเคราะห์บทความ', 'บทความ'],
    'Summarize': ['summarize', 'summary', 'สรุปความ', 'ใจความสำคัญ'],
    'Interpretation': ['interpretation', 'ตีความ'],
    'Correct Word': ['correct word', 'คำถูกต้อง', 'ใช้คำ'],
    'Incorrect Word': ['incorrect word', 'คำไม่ถูกต้อง', 'ใช้คำ'],
    'Thai Royal Vocabulary': ['ราชาศัพท์', 'royal vocabulary'],
    'Sentence Structure': ['sentence structure', 'โครงสร้างประโยค'],
    'Conjunction Usage': ['conjunction usage', 'คำสันธาน'],
    'Complete Sentence': ['complete sentence', 'ประโยคสมบูรณ์'],
    'Synonym': ['synonym', 'คำไวพจน์', 'ความหมายใกล้เคียง'],
    'Antonym': ['antonym', 'คำตรงข้าม'],
    'Word Groups': ['word groups', 'กลุ่มคำ'],
    'Tense': ['tense', 'verb tense'],
    'Preposition': ['preposition'],
    'Conjunction': ['conjunction'],
    'Article': ['article', 'a an the'],
    'Vocabulary Synonym': ['vocabulary synonym', 'synonym', 'similar meaning'],
    'Vocabulary Antonym': ['vocabulary antonym', 'antonym', 'opposite meaning'],
    'Fill in the Blank': ['fill in the blank', 'blank', 'เติมคำ'],
    'Passage Reading': ['passage reading', 'passage', 'read the passage'],
    'Story Questions': ['story questions', 'story', 'dialogue', 'conversation'],
    'พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534': ['ระเบียบบริหารราชการแผ่นดิน', '2534', 'ส่วนราชการ', 'มาตรา'],
    'พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546': ['กิจการบ้านเมืองที่ดี', '2546', 'ประโยชน์สุข', 'บริการประชาชน'],
    'พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539': ['ปฏิบัติราชการทางปกครอง', '2539', 'คำสั่งทางปกครอง'],
    'ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)': ['ความผิดต่อตำแหน่ง', 'เจ้าพนักงาน', '2499', 'ป.อ.'],
    'พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่': ['ละเมิดของเจ้าหน้าที่', 'ความรับผิด', 'ไล่เบี้ย'],
    'พ.ร.บ.มาตราฐานทางจริยธรรม 2562': ['มาตรฐานทางจริยธรรม', 'จริยธรรม', '2562']
}

def _normalize(value: str) -> str:
    return str(value or '').strip().lower()

def topic_matches(topic: str, text: str) -> bool:
    lowered = _normalize(text)
    normalized_topic = str(topic or '').strip()
    tokens = TOPIC_TOKENS.get(normalized_topic, [])

    if not tokens and normalized_topic:
        tokens = [normalized_topic, normalized_topic.replace(' ', '')]

    for token in tokens:
        if _normalize(token) and _normalize(token) in lowered:
            return True

    return False

if __name__ == '__main__':
    import sys,json
    p = json.load(sys.stdin)
    topic = p.get('topic')
    text = p.get('text','')
    print(json.dumps({'matches': topic_matches(topic,text)}))
