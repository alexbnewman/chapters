import json
import sys

from chapters.ingest import DATA_DIR

# Lives with the history it was built from; site/public/chapters.json is only the public demo.
SITE_JSON = DATA_DIR / "chapters.json"


def build() -> None:
    from chapters.eras import build as detect
    from chapters.narrate import narrate
    from chapters.questions import answer

    data = detect()
    calls = narrate(data["chapters"])
    SITE_JSON.parent.mkdir(parents=True, exist_ok=True)
    # Written before the questions are answered: Claude's `chapters` tool reads this file.
    SITE_JSON.write_text(json.dumps(data, indent=1))
    calls += answer(data)
    SITE_JSON.write_text(json.dumps(data, indent=1))
    print(f"Wrote {len(data['chapters'])} chapters to {SITE_JSON} ({calls} API calls)")


def main() -> None:
    match sys.argv[1:]:
        case ["ingest"]:
            from chapters.ingest import ingest

            print(f"Loaded {ingest():,} plays")
        case ["build"]:
            build()
        case ["api"]:
            import uvicorn

            uvicorn.run("chapters.api:app", host="127.0.0.1", port=8765)
        case _:
            from chapters.server import server

            server.run()
