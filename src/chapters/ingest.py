"""Load a Spotify streaming-history export into one DuckDB table.

Two exports work. "Extended streaming history" (Streaming_History_Audio_*.json)
is every play ever, with skips, albums and devices. The plain account export
(StreamingHistory_music_*.json) is only the last year and just when, who, what
and how long. Unzip either into data/ and run `uv run chapters ingest`.
"""

import os
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("CHAPTERS_DATA", ROOT / "data"))
DB_PATH = DATA_DIR / "chapters.duckdb"
# The zone every "which day" and "what hour" answer is given in.
TZ = "America/New_York"

EXTENDED = """
    SELECT
        ts::TIMESTAMP AS ts,
        master_metadata_track_name        AS track,
        master_metadata_album_artist_name AS artist,
        master_metadata_album_album_name  AS album,
        spotify_track_uri                 AS uri,
        ms_played,
        reason_start,
        reason_end,
        shuffle,
        -- Before 2022 skipped is blank or false on every row; the forward button is the only trace of a skip back then.
        coalesce(skipped, false) OR reason_end = 'fwdbtn' AS skipped,
        platform,
        conn_country                      AS country
    FROM read_json_auto($extended, union_by_name = true)
    -- Only keep music. Podcast and audiobook rows have a null track uri.
    WHERE spotify_track_uri IS NOT NULL
"""

# The plain export has no skip flag; under 30 seconds is the usual stand-in.
BASIC = """
    SELECT
        strptime(endTime, '%Y-%m-%d %H:%M') AS ts,
        trackName  AS track,
        artistName AS artist,
        NULL::VARCHAR AS album,
        NULL::VARCHAR AS uri,
        msPlayed   AS ms_played,
        NULL::VARCHAR AS reason_start,
        NULL::VARCHAR AS reason_end,
        NULL::BOOLEAN AS shuffle,
        msPlayed < 30000 AS skipped,
        NULL::VARCHAR AS platform,
        NULL::VARCHAR AS country
    FROM read_json($basic, columns = {endTime: 'VARCHAR', artistName: 'VARCHAR', trackName: 'VARCHAR', msPlayed: 'BIGINT'})
    -- Local files and tracks Spotify can't name all collapse into one fake song that wins every replay count.
    WHERE artistName <> 'Unknown Artist'
"""


def ingest() -> int:
    files = {
        "extended": sorted(DATA_DIR.glob("Streaming_History_Audio_*.json")),
        "basic": sorted(DATA_DIR.glob("StreamingHistory_music_*.json")),
    }
    params = {k: [str(f) for f in v] for k, v in files.items() if v}
    if not params:
        raise SystemExit(f"No Streaming_History_Audio_*.json or StreamingHistory_music_*.json files in {DATA_DIR}")

    con = duckdb.connect(DB_PATH)
    union = " UNION ALL ".join({"extended": EXTENDED, "basic": BASIC}[k] for k in params)
    con.execute(
        f"""
        CREATE OR REPLACE TABLE plays AS
        WITH every AS (
            SELECT *,
                   -- Spotify's timestamps are UTC. Without this a 1am play counts as 6am and lands on the wrong day.
                   timezone($tz, timezone('UTC', ts)) AS local_ts,
                   lag(ts) OVER (PARTITION BY artist, track ORDER BY ts) AS same_track_before
            FROM ({union})
        )
        SELECT * EXCLUDE (same_track_before) FROM every
        -- A stuck client can report one play hundreds of times a minute. A song logged again
        -- before its last report could have finished is that same play, not a new one.
        WHERE same_track_before IS NULL OR epoch(ts - same_track_before) >= ms_played / 1000.0 - 5
        ORDER BY ts
        """,
        {**params, "tz": TZ},
    )
    (count,) = con.execute("SELECT count(*) FROM plays").fetchone()
    con.close()
    return count


def connect() -> duckdb.DuckDBPyConnection:
    if not DB_PATH.exists():
        raise SystemExit("No database yet. Run `uv run chapters ingest` first.")
    return duckdb.connect(DB_PATH, read_only=True)


def rows(sql: str, params: dict | None = None) -> list[dict]:
    con = connect()
    try:
        cur = con.execute(sql, params or {})
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        con.close()
