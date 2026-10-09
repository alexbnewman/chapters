import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import anthropic
import pytest
from fastapi.testclient import TestClient

from chapters import api

STYLE = {"mood": "Dusky", "palette": ["#101010", "#202020", "#303030", "#404040"]}


@pytest.fixture
def client(monkeypatch, tmp_path):
    fake = MagicMock()
    fake.beta.messages.tool_runner.return_value.until_done.return_value = SimpleNamespace(
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text="**Frank Ocean**, 40 hours.")]
    )
    fake.messages.create.return_value = SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(STYLE))])
    monkeypatch.setattr(anthropic, "Anthropic", lambda: fake)
    monkeypatch.setattr(api, "SITE_JSON", tmp_path / "chapters.json")
    api.SITE_JSON.write_text(json.dumps({"overview": {}, "chapters": []}))
    return TestClient(api.app)


def test_chapters_serves_the_built_file(client):
    r = client.get("/api/chapters")
    assert r.status_code == 200
    assert r.json() == {"overview": {}, "chapters": []}


def test_ask_runs_tools_then_styles_the_answer(client):
    r = client.post("/api/ask", json={"question": "who did I play most?"})
    assert r.status_code == 200
    assert r.json() == {"answer": "**Frank Ocean**, 40 hours.", **STYLE}


def test_ask_offers_all_eight_tools(client):
    client.post("/api/ask", json={"question": "anything"})
    offered = anthropic.Anthropic().beta.messages.tool_runner.call_args.kwargs["tools"]
    assert [t.name for t in offered] == ["overview", "top", "history_of", "monthly_hours", "day", "records", "arcs", "chapters"]
    assert all(t.description for t in offered)
    assert json.loads(api.TOOLS[1].call({"kind": "artists", "limit": 1}))[0]["artist"]
    assert json.loads(api.TOOLS[5].call({}))["longest_streak"]["days"] == 65
    assert len(json.loads(api.TOOLS[6].call({}))["redemptions"]) == 3


def test_chapters_tool_lists_the_built_chapters(monkeypatch, tmp_path):
    built = {"id": "2019-03", "start": "2019-03", "end": "2019-07", "title": "Guitars", "mood": "Scrappy"}
    monkeypatch.setattr(api.server, "SITE_JSON", tmp_path / "chapters.json")
    api.server.SITE_JSON.write_text(json.dumps({"chapters": [built | {"hours": 1.0, "palette": []}]}))
    assert json.loads(api.TOOLS[7].call({})) == [built]


def test_health_says_whether_ask_will_work(client, monkeypatch):
    assert client.get("/api/health").json() == {"ok": True, "ask": True}
    monkeypatch.setattr(anthropic, "Anthropic", lambda: SimpleNamespace(api_key=None))
    assert client.get("/api/health").json() == {"ok": True, "ask": False}


def test_ask_without_a_key_is_a_clear_503(client, monkeypatch):
    monkeypatch.setattr(anthropic, "Anthropic", lambda: SimpleNamespace(api_key=None))
    r = client.post("/api/ask", json={"question": "anything"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]
