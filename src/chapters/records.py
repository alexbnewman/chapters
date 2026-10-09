"""Whole-history stats: records (streak, biggest day, heatmap) and arcs (songs you came around on or wore out)."""

from chapters.ingest import rows

# A track needs this many plays before its skip rate means anything.
ARC_MIN_PLAYS = 20
# How far (in percentage points) the skip rate has to move between the two halves to count.
ARC_MIN_SHIFT = 30


def most_repeated(where: str = "true", params: dict | None = None) -> dict:
    """The track played the most times on a single local day."""
    return rows(
        f"""
        SELECT track, artist, local_ts::DATE::VARCHAR AS date, count(*) AS plays
        FROM plays WHERE {where}
        GROUP BY ALL ORDER BY plays DESC, date, track, artist LIMIT 1
        """,
        params,
    )[0]


def grid(cells: list[dict]) -> list[int]:
    """24 minutes-per-hour numbers, one per hour of the day."""
    out = [0] * 24
    for c in cells:
        out[c["hour"]] = c["minutes"]
    return out


def records() -> dict:
    """All-time records: longest run of consecutive days with a play, the biggest listening day, the most one track was replayed in a day, and minutes by weekday x hour (week[0] is Monday)."""
    streak = rows(
        """
        WITH days AS (SELECT DISTINCT local_ts::DATE AS d FROM plays),
        -- Consecutive days minus a running count all land on the same date, which names the run.
        runs AS (SELECT d, d - (row_number() OVER (ORDER BY d))::INT AS run FROM days)
        SELECT count(*) AS days, min(d)::VARCHAR AS start, max(d)::VARCHAR AS "end"
        FROM runs GROUP BY run ORDER BY days DESC, start LIMIT 1
        """
    )[0]
    biggest = rows(
        """
        WITH by_artist AS (
            SELECT local_ts::DATE AS d, artist, sum(ms_played) AS ms FROM plays GROUP BY ALL
        )
        SELECT d::VARCHAR AS date, round(sum(ms) / 3.6e6, 1) AS hours, arg_max(artist, ms) AS top_artist
        FROM by_artist GROUP BY d ORDER BY sum(ms) DESC, d LIMIT 1
        """
    )[0]
    cells = rows(
        """
        SELECT isodow(local_ts) - 1 AS key, hour(local_ts) AS hour, round(sum(ms_played) / 6e4)::INT AS minutes
        FROM plays GROUP BY ALL
        """
    )
    return {
        "longest_streak": streak,
        "biggest_day": biggest,
        "most_repeated": most_repeated(),
        "week": [grid([c for c in cells if c["key"] == d]) for d in range(7)],
    }


def arc(direction: int) -> list[dict]:
    """Tracks whose skip rate fell (direction 1) or rose (-1) the most between their first and second half of plays."""
    tracks = rows(
        f"""
        WITH halves AS (
            SELECT track, artist, skipped,
                   ntile(2) OVER (PARTITION BY track, artist ORDER BY ts) AS half
            FROM plays
        ),
        per_track AS (
            SELECT track, artist,
                   round(avg(skipped::INT) FILTER (half = 1) * 100)::INT AS early_skip_pct,
                   round(avg(skipped::INT) FILTER (half = 2) * 100)::INT AS late_skip_pct,
                   count(*) AS plays
            FROM halves GROUP BY track, artist HAVING count(*) >= {ARC_MIN_PLAYS}
        )
        SELECT * FROM per_track
        WHERE {direction} * (early_skip_pct - late_skip_pct) >= {ARC_MIN_SHIFT}
        ORDER BY {direction} * (early_skip_pct - late_skip_pct) DESC, plays DESC, track, artist
        LIMIT 5
        """
    )
    for t in tracks:
        t["points"] = rows(
            """
            SELECT strftime(local_ts, '%Y-%m') AS month,
                   round(avg(skipped::INT) * 100)::INT AS skip_pct,
                   count(*) AS plays
            FROM plays WHERE track = $track AND artist = $artist
            GROUP BY month HAVING count(*) >= 3 ORDER BY month
            """,
            {"track": t["track"], "artist": t["artist"]},
        )
    return tracks


def arcs() -> dict:
    """Songs whose skip rate changed a lot over time: redemptions (skipped at first, loved later) and burnouts (the reverse), each with a month-by-month skip rate."""
    return {"redemptions": arc(1), "burnouts": arc(-1)}
