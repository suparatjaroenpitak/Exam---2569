import json
from ..topic_classifier import topic_matches

def test_pct_match():
    assert topic_matches('ร้อยละ', 'ร้อยละ 25 ของ 400')
    assert topic_matches('ร้อยละ', 'คิดเป็นเปอร์เซ็นต์')

def test_no_match():
    assert not topic_matches('ร้อยละ', 'สมการ 2x + 3 = 7')
