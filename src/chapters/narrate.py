"""Claude writes each chapter's title, blurb, mood and palette. Results are cached in data/narration.json."""

import json

import anthropic

from chapters.ingest import DATA_DIR

MODEL = "claude-opus-5"
CACHE = DATA_DIR / "narration.json"

STYLE = {
    "mood": {"type": "string", "description": "1-2 words"},
    "palette": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Exactly 4 CSS hex colors like #ff6a3d that feel like this music and read well on a near-black background",
    },
}
NARRATION = {
    "title": {"type": "string", "description": "At most 6 words"},
    "blurb": {"type": "string", "description": "1-2 sentences, second person, grounded in the numbers given"},
    **STYLE,
}


def structured(prompt: str, properties: dict) -> dict:
    """One Claude call whose reply is guaranteed to be JSON matching properties."""
    schema = {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}
    msg = anthropic.Anthropic().messages.create(
        model=MODEL,
        max_tokens=1024,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(next(b.text for b in msg.content if b.type == "text"))


def describe(chapter: dict) -> dict:
    facts = {k: v for k, v in chapter.items() if k not in ("id", "title", "blurb", "mood", "palette")}
    return structured(
        "This is one chapter of someone's Spotify listening history, "
        f"{chapter['start']} to {chapter['end']}. Write a title (at most 6 words), "
        "a 1-2 sentence blurb in the second person that refers to specific numbers or names below, "
        "a 1-2 word mood, and exactly 4 hex colors that feel like this music on a dark background.\n\n"
        + json.dumps(facts, indent=1),
        NARRATION,
    )


def narrate(chapters: list[dict]) -> int:
    """Fill title/blurb/mood/palette on each chapter in place. Returns the number of API calls made."""
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    calls = 0
    for ch in chapters:
        key = f"{ch['id']} {ch['start']} {ch['end']}"
        if key not in cache:
            cache[key] = describe(ch)
            calls += 1
            # Save after every call so a crash mid-run doesn't throw away paid results.
            CACHE.write_text(json.dumps(cache, indent=1))
        ch.update(cache[key])
    return calls
