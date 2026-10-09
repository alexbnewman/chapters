import json
from collections import Counter
from datetime import date, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from chapters.ingest import DATA_DIR, TZ, rows
from chapters.records import ARC_MIN_PLAYS, ARC_MIN_SHIFT


@pytest.fixture(scope="module")
def plays():
    return rows("SELECT ts, local_ts, ms_played, artist, track, skipped FROM plays ORDER BY ts")


def test_podcasts_are_left_out(plays):
    exported = json.loads((DATA_DIR / "Streaming_History_Audio_sample.json").read_text())
    podcasts = [r for r in exported if r["spotify_track_uri"] is None]
    assert podcasts and all(r["episode_name"] for r in podcasts)
    assert len(plays) == len(exported) - len(podcasts)
    assert all(p["track"] for p in plays)


def test_local_ts_is_the_utc_ts_in_new_york(plays):
    zone = ZoneInfo(TZ)
    for p in plays:
        assert p["local_ts"] == p["ts"].replace(tzinfo=timezone.utc).astimezone(zone).replace(tzinfo=None)
    # One from each side of the clock change, so a fixed -5 hours would fail.
    offsets = {p["ts"] - p["local_ts"] for p in plays}
    assert offsets == {timedelta(hours=4), timedelta(hours=5)}


def test_longest_streak_is_the_planted_run_of_consecutive_days(data, plays):
    streak = data["records"]["longest_streak"]
    assert streak == {"days": 65, "start": "2022-03-01", "end": "2022-05-04"}
    listened = {p["local_ts"].date() for p in plays}
    start, end = date.fromisoformat(streak["start"]), date.fromisoformat(streak["end"])
    run = [start + timedelta(days=i) for i in range(streak["days"])]
    assert run[-1] == end and listened.issuperset(run)
    assert start - timedelta(days=1) not in listened and end + timedelta(days=1) not in listened


def test_biggest_day_and_week_match_a_recount(data, plays):
    by_day, by_cell = Counter(), Counter()
    for p in plays:
        by_day[p["local_ts"].date()] += p["ms_played"]
        by_cell[p["local_ts"].weekday(), p["local_ts"].hour] += p["ms_played"]
    day, ms = by_day.most_common(1)[0]
    biggest = data["records"]["biggest_day"]
    assert biggest["date"] == str(day) and biggest["hours"] == round(ms / 3.6e6, 1)
    on_day = Counter()
    for p in plays:
        if p["local_ts"].date() == day:
            on_day[p["artist"]] += p["ms_played"]
    assert biggest["top_artist"] == on_day.most_common(1)[0][0]

    week = data["records"]["week"]
    assert len(week) == 7 and all(len(hours) == 24 for hours in week)
    for weekday in range(7):
        for hour in range(24):
            assert week[weekday][hour] == pytest.approx(by_cell[weekday, hour] / 6e4, abs=0.51)


def test_arcs_find_the_planted_songs_and_respect_the_thresholds(data, plays):
    arcs = data["arcs"]
    assert {t["track"] for t in arcs["redemptions"]} == {"Nights", "I Know the End", "Idioteque"}
    assert {t["track"] for t in arcs["burnouts"]} == {"The Less I Know the Better", "Good Days"}
    for kind, sign in (("redemptions", 1), ("burnouts", -1)):
        drops = [sign * (t["early_skip_pct"] - t["late_skip_pct"]) for t in arcs[kind]]
        assert drops == sorted(drops, reverse=True) and drops[-1] >= ARC_MIN_SHIFT
        for t in arcs[kind]:
            assert t["plays"] >= ARC_MIN_PLAYS
            months = [p["month"] for p in t["points"]]
            assert months == sorted(months) and all(p["plays"] >= 3 for p in t["points"])
            assert sum(p["plays"] for p in t["points"]) <= t["plays"]

    nights = next(t for t in arcs["redemptions"] if t["track"] == "Nights")
    skips = [p["skipped"] for p in plays if p["track"] == "Nights"]
    half = (len(skips) + 1) // 2
    assert nights["plays"] == len(skips)
    assert nights["early_skip_pct"] == round(100 * sum(skips[:half]) / half)
    assert nights["late_skip_pct"] == round(100 * sum(skips[half:]) / (len(skips) - half))
