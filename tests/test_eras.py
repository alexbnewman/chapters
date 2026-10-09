from chapters.eras import MAX_MONTHS, MIN_MONTHS, split_months
from chapters.server import monthly_hours


def chapter(data, start):
    return next(ch for ch in data["chapters"] if ch["id"] == start)


def test_chapters_cover_every_month_in_order_and_stay_short(data):
    chapters = data["chapters"]
    months = [m["month"] for m in monthly_hours()]
    covered = [m["month"] for ch in chapters for m in ch["monthly"]]
    assert covered == months
    assert 10 <= len(chapters) <= 16
    for ch in chapters:
        assert ch["start"] == ch["monthly"][0]["month"] == ch["id"]
        assert ch["end"] == ch["monthly"][-1]["month"]
        assert len(ch["monthly"]) <= MAX_MONTHS


def test_stats_are_sane(data):
    assert data["overview"] | {"hours": 0} == {
        "first_play": "2019-03-01",
        "last_play": "2024-08-31",
        "plays": 46443,
        "hours": 0,
        "artists": 48,
        "tz": "America/New_York",
        "tracks": 245,
        "days_listened": 1666,
    }
    for ch in data["chapters"]:
        assert ch["hours"] > 0
        assert len(ch["top_artists"]) == 5 and len(ch["top_tracks"]) == 5
        assert ch["top_artists"][0]["minutes"] >= ch["top_artists"][-1]["minutes"]
        assert 0 <= ch["skip_pct"] <= 100 and 0 <= ch["night_pct"] <= 100
    assert sum(ch["new_artists"] for ch in data["chapters"]) == data["overview"]["artists"]


def test_clock_adds_up_to_the_chapter_and_follows_local_time(data):
    for ch in data["chapters"]:
        assert len(ch["clock"]) == 24
        # 24 rounded hours on one side, hours rounded to 0.1 on the other.
        assert abs(sum(ch["clock"]) - ch["hours"] * 60) <= 15
    # The sample's night-owl and early-morning eras. In UTC these would sit five hours later.
    owl, lark = chapter(data, "2019-12"), chapter(data, "2022-02")
    assert owl["night_pct"] > 80 and sum(owl["clock"][6:21]) == 0
    assert lark["night_pct"] == 0 and lark["clock"].index(max(lark["clock"])) in (5, 6, 7, 8)


def test_new_minutes_share(data):
    first, *later = data["chapters"]
    assert first["new_minutes_pct"] == 100
    for ch in later:
        assert 0 <= ch["new_minutes_pct"] < 100
        assert (ch["new_minutes_pct"] == 0) == (ch["new_artists"] == 0)


def test_obsession_is_inside_its_chapter_and_finds_the_planted_day(data):
    for ch in data["chapters"]:
        assert ch["start"] <= ch["obsession"]["date"][:7] <= ch["end"]
    planted = {"track": "Be Sweet", "artist": "Japanese Breakfast", "date": "2021-06-12", "plays": 40}
    assert chapter(data, "2021-05")["obsession"] == planted
    assert data["records"]["most_repeated"] == planted


def test_split_where_the_sound_changes_and_not_on_a_quiet_month():
    a = {"a": 1e7, "b": 1e7, "c": 1e7, "d": 1e7, "e": 1e7}
    z = {"v": 1e7, "w": 1e7, "x": 1e7, "y": 1e7, "z": 1e7}
    quiet = {"v": 1e5}
    by_month = {f"{m:02}": a for m in range(1, 6)} | {"06": quiet} | {f"{m:02}": z for m in range(7, 13)}
    assert split_months(by_month) == [["01", "02", "03", "04", "05", "06"], ["07", "08", "09", "10", "11", "12"]]


def test_a_long_settled_stretch_is_still_cut():
    a = {"a": 1e7, "b": 1e7}
    chapters = split_months({f"{m:02}": a for m in range(1, 31)})
    assert [m for ch in chapters for m in ch] == [f"{m:02}" for m in range(1, 31)]
    assert all(MIN_MONTHS <= len(ch) <= MAX_MONTHS for ch in chapters)
