"""HTTP API for the site: the built chapters, and free-form questions answered by Claude using the MCP tools."""

import functools
import json

import anthropic
from anthropic import beta_tool
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from chapters import SITE_JSON, server
from chapters.narrate import MODEL, STYLE, structured

SYSTEM = (
    "You answer questions about the user's own Spotify listening history using the tools. "
    "Reply in 2-5 sentences of markdown, quoting the specific numbers, artists and dates you found."
)


def as_tool(fn):
    # The MCP tools return dicts and lists; the tool runner can only hand Claude text.
    @functools.wraps(fn)
    def wrapped(*args, **kwargs):
        return json.dumps(fn(*args, **kwargs), default=str)

    return beta_tool(wrapped)


TOOLS = [
    as_tool(f)
    for f in (
        server.overview,
        server.top,
        server.history_of,
        server.monthly_hours,
        server.day,
        server.records,
        server.arcs,
        server.chapters,
    )
]


def ask(client: anthropic.Anthropic, question: str) -> dict:
    final = (
        client.beta.messages.tool_runner(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM,
            tools=TOOLS,
            messages=[{"role": "user", "content": question}],
        )
        .until_done()
    )
    answer = "".join(b.text for b in final.content if b.type == "text")
    style = structured(
        "Give a 1-2 word mood and exactly 4 hex colors, readable on a dark background, "
        "that feel like the music in this answer:\n\n" + answer,
        STYLE,
    )
    return {"answer": answer, **style}


class Question(BaseModel):
    question: str


app = FastAPI()


@app.get("/api/chapters")
def get_chapters():
    return FileResponse(SITE_JSON)


@app.get("/api/health")
def get_health():
    return {"ok": True, "ask": bool(anthropic.Anthropic().api_key)}


@app.post("/api/ask")
def post_ask(q: Question):
    client = anthropic.Anthropic()
    # Without a key the SDK only fails once the request is sent, as a bare 500 that tells a direct caller nothing.
    if not client.api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set where the API runs")
    return ask(client, q.question)
