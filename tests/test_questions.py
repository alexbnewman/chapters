import json

import pytest

from chapters import questions

ANSWER = {"answer": "**Daft Punk**, 2022.", "mood": "Electric", "palette": ["#111111", "#222222", "#333333", "#444444"]}


@pytest.fixture
def asked(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(questions, "CACHE", tmp_path / "answers.json")
    monkeypatch.setattr(questions.anthropic, "Anthropic", lambda: None)
    monkeypatch.setattr(questions, "ask", lambda client, q: calls.append(q) or ANSWER)
    return calls


def test_questions_are_filled_in_from_the_data(data):
    qs = questions.questions(data)
    assert len(qs) == len(set(qs)) == 6
    assert "When did I first hear Nujabes?" in qs
    assert "What was I listening to on 2022-02-19?" in qs
    assert "What was I playing during my 65-day streak?" in qs


def test_only_uncached_questions_are_asked(data, asked):
    first, *rest = questions.questions(data)
    questions.CACHE.write_text(json.dumps({first: ANSWER}))
    out = dict(data)
    assert questions.answer(out) == len(rest)
    assert asked == rest
    assert out["questions"] == [{"question": q, **ANSWER} for q in [first, *rest]]
    assert questions.answer(out) == 0 and asked == rest
