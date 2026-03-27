from ai_engine.topic_classifier import classify_topic, topic_matches

def test_percentage_topic_match():
    assert topic_matches('Percentage', 'ร้อยละ 25 ของ 400 เท่ากับเท่าใด')
    assert topic_matches('Percentage', 'คิดเป็นเปอร์เซ็นต์จากยอดรวมทั้งหมด')

def test_law_topic_match():
    text = 'การออกคำสั่งทางปกครองต้องรับฟังคู่กรณีก่อนตามหลักความเป็นธรรม'
    assert topic_matches('พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539', text)

def test_topic_classifier_returns_expected_label():
    predicted, score = classify_topic('ร้อยละ 20 ของ 500 เท่ากับเท่าใด', ['Percentage', 'Equation'])
    assert predicted == 'Percentage'
    assert score > 0

def test_no_match():
    assert not topic_matches('Percentage', 'สมการ 2x + 3 = 7')
