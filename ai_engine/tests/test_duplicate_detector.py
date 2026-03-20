from ..duplicate_detector import is_duplicate

def test_duplicate_detected():
    existing = ["หา x จาก 2x + 3 = 7", "ร้อยละ 25 ของ 200 เท่ากับเท่าใด"]
    assert is_duplicate("ร้อยละ 25 ของ 200 เท่ากับเท่าใด?", existing, threshold=0.8)

def test_not_duplicate():
    existing = ["สมการ 2x + 3 = 7", "คำนวณความเร็ว=ระยะทาง/เวลา"]
    assert not is_duplicate("วิเคราะห์บทความเรื่องสิ่งแวดล้อม", existing, threshold=0.8)
