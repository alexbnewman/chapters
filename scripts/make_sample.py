"""Write a fake but lifelike Streaming_History_Audio file into data/sample/ so everything can be tried before the real export arrives.

Five and a half years of plays whose taste moves in eras, with a few stories planted on purpose
(see the constants below). Seeded, so every run writes the same history.

Run: uv run scripts/make_sample.py
"""

import json
import random
import zlib
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ARTISTS = {
    "Arctic Monkeys": ["Do I Wanna Know?", "505", "R U Mine?", "Fluorescent Adolescent", "Cornerstone"],
    "The Strokes": ["Last Nite", "Reptilia", "Someday", "The Adults Are Talking", "Hard to Explain"],
    "Tame Impala": ["The Less I Know the Better", "Let It Happen", "Borderline", "Elephant", "Feels Like We Only Go Backwards"],
    "Radiohead": ["Weird Fishes / Arpeggi", "Everything in Its Right Place", "Let Down", "Idioteque", "No Surprises", "Reckoner"],
    "LCD Soundsystem": ["All My Friends", "Dance Yrself Clean", "Someone Great", "Daft Punk Is Playing at My House", "oh baby"],
    "Talking Heads": ["This Must Be the Place (Naive Melody)", "Once in a Lifetime", "Psycho Killer", "Road to Nowhere", "Burning Down the House"],
    "Fleetwood Mac": ["Dreams", "The Chain", "Everywhere", "Go Your Own Way", "Landslide"],
    "Kendrick Lamar": ["Money Trees", "Alright", "N95", "HUMBLE.", "DNA.", "Swimming Pools (Drank)"],
    "Tyler, The Creator": ["EARFQUAKE", "See You Again", "NEW MAGIC WAND", "WUSYANAME", "Yonkers"],
    "Frank Ocean": ["Nights", "Ivy", "Self Control", "Pink + White", "Thinkin Bout You", "Chanel"],
    "OutKast": ["Ms. Jackson", "Hey Ya!", "So Fresh, So Clean", "Roses", "ATLiens"],
    "A Tribe Called Quest": ["Can I Kick It?", "Electric Relaxation", "Award Tour", "Check the Rhime", "Scenario"],
    "Mac Miller": ["Self Care", "Good News", "Circles", "Dang!", "Ladders"],
    "Burial": ["Archangel", "Untrue", "Near Dark", "Ghost Hardware", "Shell of Light"],
    "Aphex Twin": ["Xtal", "Avril 14th", "Windowlicker", "Alberto Balsalm", "#3"],
    "Boards of Canada": ["Roygbiv", "Dayvan Cowboy", "Olson", "Aquarius", "Music Is Math"],
    "Four Tet": ["Baby", "Two Thousand and Seventeen", "Parallel Jalebi", "Lush", "Teenage Birdsong"],
    "Brian Eno": ["An Ending (Ascent)", "1/1", "By This River", "Deep Blue Day", "Emerald and Stone"],
    "Phoebe Bridgers": ["Motion Sickness", "Kyoto", "Garden Song", "Scott Street", "Funeral", "I Know the End"],
    "Fleet Foxes": ["White Winter Hymnal", "Mykonos", "Helplessness Blues", "Blue Ridge Mountains", "Can I Believe You"],
    "Bon Iver": ["Skinny Love", "Holocene", "Flume", "Re: Stacks", "Hey, Ma"],
    "Sufjan Stevens": ["Chicago", "Mystery of Love", "Should Have Known Better", "Fourth of July", "Casimir Pulaski Day"],
    "Big Thief": ["Paul", "Not", "Masterpiece", "Simulation Swarm", "Shark Smile"],
    "Mitski": ["Nobody", "Washing Machine Heart", "First Love / Late Spring", "Your Best American Girl", "My Love Mine All Mine"],
    "MF DOOM": ["Rapp Snitch Knishes", "Accordion", "Doomsday", "All Caps", "One Beer"],
    "Nujabes": ["Feather", "Aruarian Dance", "Luv(sic) Pt. 3", "Reflection Eternal", "Counting Stars"],
    "Miles Davis": ["So What", "Blue in Green", "Freddie Freeloader", "All Blues", "Flamenco Sketches"],
    "John Coltrane": ["Naima", "Giant Steps", "My Favorite Things", "In a Sentimental Mood", "Blue Train"],
    "Khruangbin": ["Maria También", "White Gloves", "Time (You and I)", "Evan Finds the Third Room", "So We Won't Forget"],
    "Japanese Breakfast": ["Be Sweet", "Paprika", "Kokomo, IN", "Boyish", "Everybody Wants to Love You"],
    "Alvvays": ["Archie, Marry Me", "Dreams Tonite", "In Undertow", "Adult Diversion", "Pharmacist"],
    "Lorde": ["Ribs", "Green Light", "Supercut", "Royals", "The Louvre"],
    "Caroline Polachek": ["So Hot You're Hurting My Feelings", "Bunny Is a Rider", "Door", "Welcome to My Island", "Pang"],
    "Deftones": ["Change (In the House of Flies)", "My Own Summer (Shove It)", "Sextape", "Be Quiet and Drive (Far Away)", "Digital Bath"],
    "Slowdive": ["When the Sun Hits", "Alison", "Sugar for the Pill", "Souvlaki Space Station", "40 Days"],
    "My Bloody Valentine": ["Only Shallow", "When You Sleep", "Sometimes", "Soon", "To Here Knows When"],
    "The National": ["Bloodbuzz Ohio", "Fake Empire", "I Need My Girl", "Mr. November", "About Today"],
    "Daft Punk": ["One More Time", "Digital Love", "Around the World", "Instant Crush", "Get Lucky", "Harder, Better, Faster, Stronger"],
    "Caribou": ["Can't Do Without You", "Odessa", "Sun", "Never Come Back", "Home"],
    "Jamie xx": ["Gosh", "Loud Places", "I Know There's Gonna Be (Good Times)", "Sleep Sound", "Girl"],
    "Fred again..": ["Marea (we've lost dancing)", "Delilah (pull me out of this)", "Danielle (smile on my face)", "Jungle", "Kyle (i found you)"],
    "Beyoncé": ["CUFF IT", "Formation", "Love On Top", "ALIEN SUPERSTAR", "Halo"],
    "SZA": ["Good Days", "Kill Bill", "The Weekend", "Snooze", "Love Galore"],
    "Solange": ["Cranes in the Sky", "Don't Touch My Hair", "Almeda", "Losing You", "Binz"],
    "Blood Orange": ["You're Not Good Enough", "Charcoal Baby", "Best to You", "Saint", "Champagne Coast"],
    "Charli XCX": ["Vroom Vroom", "360", "Von dutch", "Boys", "Gone"],
    "Nina Simone": ["Feeling Good", "Sinnerman", "I Put a Spell on You", "My Baby Just Cares for Me", "Don't Let Me Be Misunderstood"],
    "Little Simz": ["Introvert", "Woman", "Venom", "Selfish", "Point and Kill"],
}
# Local hours a session can start in. "night" and "early" are the night-owl and early-morning eras.
HOURS = {
    "day": [8, 9, 10, 12, 13, 15, 17, 18, 20, 21],
    "evening": [12, 17, 18, 19, 20, 21, 22, 22],
    "night": [21, 23, 23, 0, 0, 1, 2, 3],
    "early": [5, 5, 6, 6, 7, 7, 8, 12, 18],
}
# (months, hours, artists from most to least played). Starts 2019-03; neighbours share one or two artists.
ERAS = [
    (5, "day", "Arctic Monkeys|The Strokes|Tame Impala|Radiohead|LCD Soundsystem|Talking Heads|Fleetwood Mac"),
    (4, "evening", "Kendrick Lamar|Tyler, The Creator|Frank Ocean|OutKast|Tame Impala|A Tribe Called Quest|Mac Miller"),
    (6, "night", "Burial|Aphex Twin|Boards of Canada|Frank Ocean|Four Tet|Brian Eno|Radiohead"),
    (3, "day", "Phoebe Bridgers|Fleet Foxes|Bon Iver|Sufjan Stevens|Big Thief|Four Tet|Mitski"),
    (8, "evening", "MF DOOM|Nujabes|A Tribe Called Quest|Miles Davis|Phoebe Bridgers|John Coltrane|Khruangbin"),
    (5, "day", "Japanese Breakfast|Mitski|Alvvays|Lorde|Big Thief|Khruangbin|Caroline Polachek"),
    (4, "evening", "Deftones|Slowdive|My Bloody Valentine|Radiohead|The National|Burial|Mitski"),
    (6, "early", "Daft Punk|Caribou|Jamie xx|Fred again..|LCD Soundsystem|Four Tet|Slowdive"),
    (5, "evening", "Beyoncé|SZA|Solange|Blood Orange|Charli XCX|Fred again..|Frank Ocean"),
    (4, "day", "Miles Davis|John Coltrane|Nina Simone|Brian Eno|Bon Iver|Solange|Nujabes"),
    (6, "day", "Little Simz|Kendrick Lamar|SZA|Tyler, The Creator|Mac Miller|OutKast|Nina Simone"),
    (5, "evening", "Radiohead|The National|Sufjan Stevens|Fleet Foxes|Talking Heads|Phoebe Bridgers|Little Simz"),
    (5, "day", "Charli XCX|Caroline Polachek|Lorde|Japanese Breakfast|Beyoncé|Tame Impala|Talking Heads"),
]
# track: (turning point, chance of a skip before it, after it). First three are redemptions, last two burnouts.
ARCS = {
    "Nights": (date(2020, 2, 1), 0.8, 0.05),
    "I Know the End": (date(2020, 12, 1), 0.8, 0.05),
    "Idioteque": (date(2021, 12, 1), 0.8, 0.05),
    "The Less I Know the Better": (date(2019, 8, 1), 0.05, 0.8),
    "Good Days": (date(2023, 1, 1), 0.05, 0.8),
}
OBSESSION = (date(2021, 6, 12), "Japanese Breakfast", ["Be Sweet"] * 40)
STREAK = (date(2022, 3, 1), date(2022, 5, 4))  # 65 days, with a silent day either side
QUIET = (2021, 8)  # one month with a single short session
NY = ZoneInfo("America/New_York")


def row(t: datetime, platform: str, ms: int, skipped: bool, artist=None, track=None, episode=None) -> dict:
    return {
        # The real export stamps each play in UTC, so local wall-clock time is converted on the way out.
        "ts": t.replace(tzinfo=NY).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platform": platform,
        "ms_played": ms,
        "conn_country": "US",
        "master_metadata_track_name": track,
        "master_metadata_album_artist_name": artist,
        "master_metadata_album_album_name": artist and f"{artist} album",
        "spotify_track_uri": track and f"spotify:track:{zlib.crc32(f'{artist}/{track}'.encode()):010d}",
        "episode_name": episode,
        "episode_show_name": episode and "99% Invisible",
        "spotify_episode_uri": episode and f"spotify:episode:{zlib.crc32(episode.encode()):010d}",
        "reason_start": "trackdone",
        "reason_end": "fwdbtn" if skipped else "trackdone",
        "shuffle": True,
        "skipped": skipped,
        "offline": False,
        "incognito_mode": False,
    }


random.seed(7)
rows, seen = [], []
day, month = datetime(2019, 3, 1), 2019 * 12 + 2
for months, hours, names in ERAS:
    era = names.split("|")
    month += months
    while day < datetime(month // 12, month % 12 + 1, 1):
        d = day.date()
        if (d.year, d.month) == QUIET:
            sessions = int(d.day == 14)
        elif d in (STREAK[0] - timedelta(days=1), STREAK[1] + timedelta(days=1)):
            sessions = 0
        else:
            sessions = random.randint(1, 5) if STREAK[0] <= d <= STREAK[1] or random.random() < 0.85 else 0
        queue = []
        for hour in random.choices(HOURS[hours], k=sessions):
            # Mostly this era's artists, sometimes an old favourite from an earlier one.
            old = seen and random.random() < 0.12
            artist = random.choice(seen) if old else random.choices(era, weights=range(len(era), 0, -1))[0]
            queue.append((hour, artist, random.choices(ARTISTS[artist], k=random.randint(4, 15))))
        if d == OBSESSION[0]:
            queue.append((14, *OBSESSION[1:]))
        t = day
        for hour, artist, tracks in sorted(queue):
            t = max(t, day + timedelta(hours=hour, minutes=random.randrange(60)))
            platform = random.choices(["ios", "osx", "web_player"], weights=[6, 3, 1])[0]
            if random.random() < 0.03:
                rows.append(row(t, platform, 1_500_000, False, episode=f"Episode {len(rows)}"))
            for track in tracks:
                turn, before, after = ARCS.get(track, (d, 0.18, 0.18))
                skipped = random.random() < (before if d < turn else after)
                ms = int(random.uniform(3_000, 30_000) if skipped else random.uniform(150_000, 280_000))
                t += timedelta(milliseconds=ms)
                # A session stops at midnight, so the silent days around the streak stay silent.
                if t.date() != d:
                    break
                rows.append(row(t, platform, ms, skipped, artist, track))
        day += timedelta(days=1)
    seen += [a for a in era if a not in seen]

out = Path(__file__).resolve().parents[1] / "data" / "sample" / "Streaming_History_Audio_sample.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(rows))
print(f"Wrote {len(rows)} rows to {out}")
