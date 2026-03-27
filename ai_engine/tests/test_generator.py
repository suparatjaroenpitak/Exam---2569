from ai_engine.generator import generate_questions


def test_generation_never_returns_zero():
    result = generate_questions({
        'category': 'Analytical Thinking',
        'subcategory': 'Percentage',
        'difficulty': 'easy',
        'count': 3,
    })
    assert len(result) >= 1
    assert all(item['question'] for item in result)


def test_generation_uses_requested_topic():
    result = generate_questions({
        'category': 'Government Law & Ethics',
        'subcategory': 'พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539',
        'difficulty': 'medium',
        'count': 1,
    })
    assert 'พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539' in result[0]['question']