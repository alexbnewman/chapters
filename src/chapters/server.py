"""MCP server: lets Claude ask questions about your Spotify listening history."""

import json
from datetime import date

from mcp.server.mcpserver import MCPServer

from chapters import SITE_JSON
from chapters.ingest import TZ, rows
from chapters.records import arcs, records

server = MCPServer(
    "chapters",
    instructions=(
        "Tools over one person's complete Spotify play history. "
        "Call overview first to learn the date range, then narrow down. "
        f"Every date and hour is in {TZ} time."
    ),
)


@server.tool()
def overview() -> dict:
    """Date range, total plays, hours, distinct artists and tracks, days with any listening, and the time zone used."""
    return rows(
        """
        SELECT min(local_ts)::DATE::VARCHAR AS first_play,
               max(local_ts)::DATE::VARCHAR AS last_play,
               count(*)               AS plays,
               round(sum(ms_played) / 3.6e6, 1) AS hours,
               count(DISTINCT artist) AS artists,
               $tz                    AS tz,
               count(DISTINCT (track, artist)) AS tracks,
               count(DISTINCT local_ts::DATE) AS days_listened
        FROM plays
        """,
        {"tz": TZ},
    )[0]


@server.tool()
def top(
    kind: str = "artists",
    start: date | None = None,
    end: date | None = None,
    limit: int = 10,
) -> list[dict]:
    """Most-listened artists, tracks or albums by minutes, optionally within a date range (start and end dates are both included).

    kind is one of: artists, tracks, albums.
    """
    group = {"artists": "artist", "tracks": "track, artist", "albums": "album, artist"}[kind]
    return rows(
        f"""
        SELECT {group},
               count(*) AS plays,
               round(sum(ms_played) / 6e4) AS minutes
        FROM plays
        WHERE ($start IS NULL OR local_ts >= $start)
          AND ($end   IS NULL OR local_ts::DATE <= $end)
        GROUP BY {group}
        ORDER BY sum(ms_played) DESC, {group}
        LIMIT $limit
        """,
        {"start": start, "end": end, "limit": limit},
    )


@server.tool()
def history_of(query: str) -> dict:
    """Everything about one artist or track: first and last time heard, play count, minutes and skip rate.

    Matches case-insensitively against artist and track names.
    """
    result = rows(
        """
        SELECT min(local_ts)::DATE::VARCHAR AS first_heard,
               max(local_ts)::DATE::VARCHAR AS last_heard,
               count(*) AS plays,
               round(sum(ms_played) / 6e4) AS minutes,
               round(avg(skipped::INT) * 100) AS skip_pct,
               count(DISTINCT track) AS distinct_tracks
        FROM plays
        WHERE artist ILIKE '%' || $q || '%' OR track ILIKE '%' || $q || '%'
        """,
        {"q": query},
    )[0]
    result["query"] = query
    return result


@server.tool()
def monthly_hours(start: date | None = None, end: date | None = None) -> list[dict]:
    """Hours listened per month, plus that month's top artist. Good for spotting eras. start and end dates are both included."""
    return rows(
        """
        WITH by_month AS (
            SELECT strftime(local_ts, '%Y-%m') AS month, artist, sum(ms_played) AS ms
            FROM plays
            WHERE ($start IS NULL OR local_ts >= $start)
              AND ($end   IS NULL OR local_ts::DATE <= $end)
            GROUP BY 1, 2
        )
        SELECT month,
               round(sum(ms) / 3.6e6, 1) AS hours,
               arg_max(artist, ms) AS top_artist
        FROM by_month
        GROUP BY month
        ORDER BY month
        """,
        {"start": start, "end": end},
    )


@server.tool()
def day(on: date) -> list[dict]:
    """Listening sessions on one day: start time, length, and what played.

    A new session starts after a gap of 30+ minutes between plays.
    """
    return rows(
        """
        WITH gaps AS (
            SELECT local_ts, track, artist, ms_played,
                   local_ts - lag(local_ts) OVER (ORDER BY local_ts) > INTERVAL 30 MINUTE AS new_session
            FROM plays
            WHERE local_ts::DATE = $on
        ),
        numbered AS (
            SELECT *, count(new_session OR NULL) OVER (ORDER BY local_ts) AS session
            FROM gaps
        )
        SELECT strftime(min(local_ts), '%H:%M') AS started,
               round(sum(ms_played) / 6e4) AS minutes,
               count(*) AS plays,
               list(track || ' — ' || artist ORDER BY local_ts) AS tracks
        FROM numbered
        GROUP BY session
        ORDER BY session
        """,
        {"on": on},
    )


server.tool()(records)
server.tool()(arcs)


@server.tool()
def chapters() -> list[dict]:
    """The named chapters the history is split into: id, start and end month, title and mood. start and end are months (YYYY-MM), both included; for other tools pass the first day of start and the last day of end."""
    built = json.loads(SITE_JSON.read_text())["chapters"]
    return [{k: ch[k] for k in ("id", "start", "end", "title", "mood")} for ch in built]
