import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import anthropic
import pytest

from chapters import narrate

WRITTEN = {"title": "Two Weeks of Doom", "blurb": "You...", "mood": "Heavy", "palette": ["#111111", "#222222", "#333333", "#444444"]}


@pytest.fixture
def client(monkeypatch, tmp_path):
    fake = MagicMock()
    fake.messages.create.return_value = SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(WRITTEN))])
    monkeypatch.setattr(anthropic, "Anthropic", lambda: fake)
    monkeypatch.setattr(narrate, "CACHE", tmp_path / "narration.json")
    return fake


def chapter():
    return {"id": "2023-01", "start": "2023-01", "end": "2023-02", "hours": 5.0, "top_artists": []}


def test_cache_hit_makes_no_call(client):
    narrate.CACHE.write_text(json.dumps({"2023-01 2023-01 2023-02": WRITTEN}))
    ch = chapter()
    assert narrate.narrate([ch]) == 0
    client.messages.create.assert_not_called()
    assert ch["title"] == WRITTEN["title"]


def test_cache_miss_calls_once_and_writes_cache(client):
    ch = chapter()
    assert narrate.narrate([ch]) == 1
    client.messages.create.assert_called_once()
    assert client.messages.create.call_args.kwargs["output_config"]["format"]["type"] == "json_schema"
    assert ch["palette"] == WRITTEN["palette"]
    assert json.loads(narrate.CACHE.read_text()) == {"2023-01 2023-01 2023-02": WRITTEN}
