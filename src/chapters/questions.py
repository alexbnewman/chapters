"""The suggested questions on the site, answered ahead of time. Results are cached in data/answers.json."""

import json

import anthropic

from chapters.api import ask
from chapters.ingest import DATA_DIR

CACHE = DATA_DIR / "answers.json"


def questions(data: dict) -> list[str]:
    """Questions worth asking of this particular history, filled in from its own stats."""
    records = data["records"]
    favourite = max(data["chapters"], key=lambda ch: ch["top_artists"][0]["minutes"])["top_artists"][0]["name"]
    return [
        f"When did I first hear {favourite}?",
        f"What was I listening to on {records['biggest_day']['date']}?",
        "Which song did I learn to love?",
        "Which song did I wear out?",
        "When was my night-owl era?",
        f"What was I playing during my {records['longest_streak']['days']}-day streak?",
    ]


def answer(data: dict) -> int:
    """Set data["questions"] to each question with its answer. Returns the number it had to ask Claude."""
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    asked = 0
    for q in questions(data):
        if q not in cache:
            cache[q] = ask(anthropic.Anthropic(), q)
            asked += 1
            # Save after every answer so a crash mid-run doesn't throw away paid results.
            CACHE.write_text(json.dumps(cache, indent=1))
    data["questions"] = [{"question": q, **cache[q]} for q in questions(data)]
    return asked
