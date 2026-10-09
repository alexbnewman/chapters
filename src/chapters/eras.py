"""Split the play history into chapters: cut where a month sounds least like the months before it."""

import math

from chapters.records import arcs, grid, most_repeated, records
from chapters.server import overview, rows

# Aim for one chapter per this many months; cuts go where taste moved most.
TARGET_MONTHS = 6
MIN_MONTHS = 2
# A long settled stretch still gets cut, else one chapter can swallow three years.
MAX_MONTHS = 12
# A month is compared with this many months before it, so one odd month doesn't look like a new era.
WINDOW = 3
# Never cut where the month still mostly sounds like before.
SPLIT_BELOW = 0.5
# Below this, a month is noise and shouldn't be allowed to open a chapter.
QUIET_MS = 3.6e6


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    norm = math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values()))
    return dot / norm if norm else 0.0


def scores(by_month: dict[str, dict[str, float]]) -> dict[int, float]:
    """How much each month sounds like the WINDOW months before it, by minutes per artist. 0 = nothing in common."""
    months = list(by_month)
    out = {}
    for i in range(1, len(months)):
        before: dict[str, float] = {}
        for m in months[max(0, i - WINDOW) : i]:
            for artist, ms in by_month[m].items():
                before[artist] = before.get(artist, 0) + ms
        now = by_month[months[i]]
        out[i] = 1.0 if sum(now.values()) < QUIET_MS else cosine(now, before)
    return out


def split_months(by_month: dict[str, dict[str, float]]) -> list[list[str]]:
    """Group ordered months into chapters. by_month is {month: {artist: ms_played}}."""
    months = list(by_month)
    score = scores(by_month)
    edges = {0, len(months)}

    def fits(i: int) -> bool:
        lo, hi = max(e for e in edges if e < i), min(e for e in edges if e > i)
        return i - lo >= MIN_MONTHS and hi - i >= MIN_MONTHS

    wanted = len(months) // TARGET_MONTHS
    for i in sorted(score, key=lambda i: (score[i], i)):
        if len(edges) - 2 >= wanted or score[i] >= SPLIT_BELOW:
            break
        if fits(i):
            edges.add(i)
    while True:
        pairs = sorted(edges)
        long = [(a, b) for a, b in zip(pairs, pairs[1:]) if b - a > MAX_MONTHS]
        if not long:
            break
        a, b = long[0]
        edges.add(min(range(a + MIN_MONTHS, b - MIN_MONTHS + 1), key=lambda i: (score[i], abs(i - (a + b) / 2))))
    pairs = sorted(edges)
    return [months[a:b] for a, b in zip(pairs, pairs[1:])]


def stats(start: str, end: str) -> dict:
    """Every non-narrated contract field for the inclusive month range start..end."""
    span = {"start": start, "end": end}
    where = "strftime(local_ts, '%Y-%m') BETWEEN $start AND $end"
    totals = rows(
        f"""
        SELECT round(sum(ms_played) / 3.6e6, 1) AS hours,
               round(avg(skipped::INT) * 100)::INT AS skip_pct,
               round(avg((hour(local_ts) >= 23 OR hour(local_ts) <= 4)::INT) * 100)::INT AS night_pct
        FROM plays WHERE {where}
        """,
        span,
    )[0]
    # Artists whose first-ever play lands inside this chapter, and how much of the chapter went to them.
    new = rows(
        f"""
        WITH firsts AS (SELECT artist, min(local_ts) AS local_ts FROM plays GROUP BY artist),
        fresh AS (SELECT artist FROM firsts WHERE {where})
        SELECT (SELECT count(*) FROM fresh) AS new_artists,
               -- A chapter with no new artists sums nothing, which is NULL rather than 0.
               coalesce(round(100 * sum(ms_played) FILTER (artist IN (FROM fresh)) / sum(ms_played)), 0)::INT AS new_minutes_pct
        FROM plays WHERE {where}
        """,
        span,
    )[0]
    clock = rows(
        f"""
        SELECT hour(local_ts) AS hour, round(sum(ms_played) / 6e4)::INT AS minutes
        FROM plays WHERE {where} GROUP BY ALL
        """,
        span,
    )
    return {
        "id": start,
        "start": start,
        "end": end,
        **totals,
        "top_artists": rows(
            f"""
            SELECT artist AS name, round(sum(ms_played) / 6e4)::INT AS minutes
            FROM plays WHERE {where} GROUP BY artist ORDER BY sum(ms_played) DESC, artist LIMIT 5
            """,
            span,
        ),
        "top_tracks": rows(
            f"""
            SELECT track AS name, artist, round(sum(ms_played) / 6e4)::INT AS minutes
            FROM plays WHERE {where} GROUP BY track, artist ORDER BY sum(ms_played) DESC, track, artist LIMIT 5
            """,
            span,
        ),
        "monthly": rows(
            f"""
            SELECT strftime(local_ts, '%Y-%m') AS month, round(sum(ms_played) / 3.6e6, 1) AS hours
            FROM plays WHERE {where} GROUP BY month ORDER BY month
            """,
            span,
        ),
        **new,
        "clock": grid(clock),
        "obsession": most_repeated(where, span),
    }


def build() -> dict:
    """The contract JSON minus the Claude-written fields."""
    by_month: dict[str, dict[str, float]] = {}
    for r in rows(
        """
        SELECT strftime(local_ts, '%Y-%m') AS month, artist, sum(ms_played) AS ms
        FROM plays GROUP BY month, artist ORDER BY month
        """
    ):
        by_month.setdefault(r["month"], {})[r["artist"]] = r["ms"]
    return {
        "overview": overview(),
        "chapters": [stats(months[0], months[-1]) for months in split_months(by_month)],
        "records": records(),
        "arcs": arcs(),
    }
