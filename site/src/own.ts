// Someone's own Spotify export, read and analysed entirely in the browser.
// Mirrors ingest.py, eras.py and records.py; nothing is uploaded anywhere.
import JSZip from 'jszip'
import { hour, mon, type Arc, type Chapter, type Data, type Records, type Repeat } from './data'
import type { Palette } from './theme'

type Play = { t: number; track: string; artist: string; ms: number; skipped: boolean }
type Local = Play & { month: string; date: string; hour: number; dow: number }

const EXTENDED = /Streaming_History_Audio_.*\.json$/
const BASIC = /StreamingHistory_music_.*\.json$/

export async function readExport(files: File[]): Promise<Play[]> {
  const texts: { name: string; text: string }[] = []
  for (const f of files) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      const zip = await JSZip.loadAsync(f)
      for (const entry of Object.values(zip.files)) {
        if (!entry.dir && (EXTENDED.test(entry.name) || BASIC.test(entry.name))) texts.push({ name: entry.name, text: await entry.async('string') })
      }
    } else if (EXTENDED.test(f.name) || BASIC.test(f.name)) {
      texts.push({ name: f.name, text: await f.text() })
    }
  }
  if (!texts.length) throw new Error('No Streaming_History_Audio or StreamingHistory_music files in there.')

  const plays: Play[] = []
  for (const { name, text } of texts) {
    for (const r of JSON.parse(text)) {
      if (EXTENDED.test(name)) {
        // Podcasts and audiobooks have no track uri.
        if (!r.spotify_track_uri) continue
        // Before 2022 the skipped flag is never set; the forward button is the only trace of a skip.
        plays.push({ t: Date.parse(r.ts), track: r.master_metadata_track_name, artist: r.master_metadata_album_artist_name, ms: r.ms_played, skipped: !!r.skipped || r.reason_end === 'fwdbtn' })
      } else {
        // The plain export has no skip flag; under 30 seconds is the usual stand-in.
        if (r.artistName === 'Unknown Artist') continue
        plays.push({ t: Date.parse(r.endTime.replace(' ', 'T') + 'Z'), track: r.trackName, artist: r.artistName, ms: r.msPlayed, skipped: r.msPlayed < 30000 })
      }
    }
  }
  plays.sort((a, b) => a.t - b.t)
  // A stuck client can report one play hundreds of times a minute. A song logged again
  // before its last report could have finished is that same play, not a new one.
  // The 65 seconds of slack keep the plain export's minute-only timestamps from tripping it.
  const last = new Map<string, number>()
  return plays.filter((p) => {
    const key = p.artist + '\0' + p.track
    const prev = last.get(key)
    last.set(key, p.t)
    return prev === undefined || (p.t - prev) / 1000 >= p.ms / 1000 - 65
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

function localise(plays: Play[]): Local[] {
  return plays.map((p) => {
    const d = new Date(p.t)
    const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    return { ...p, month, date: `${month}-${pad(d.getDate())}`, hour: d.getHours(), dow: (d.getDay() + 6) % 7 }
  })
}

export function analyse(plays: Play[]): Data {
  const P = localise(plays)
  const byMonth = new Map<string, Map<string, number>>()
  const firstMonth = new Map<string, string>()
  for (const p of P) {
    let m = byMonth.get(p.month)
    if (!m) byMonth.set(p.month, (m = new Map()))
    m.set(p.artist, (m.get(p.artist) ?? 0) + p.ms)
    if (!firstMonth.has(p.artist)) firstMonth.set(p.artist, p.month)
  }
  const months = [...byMonth.keys()].sort()
  const chapters = splitMonths(months, byMonth).map((ms, i) => narrate(stats(P, ms[0], ms[ms.length - 1], firstMonth), i === 0))
  return {
    overview: {
      first_play: P[0].date,
      last_play: P[P.length - 1].date,
      plays: P.length,
      hours: round1(sum(P, (p) => p.ms) / 3.6e6),
      artists: firstMonth.size,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tracks: new Set(P.map((p) => p.artist + '\0' + p.track)).size,
      days_listened: new Set(P.map((p) => p.date)).size,
    },
    chapters,
    records: records(P),
    arcs: { redemptions: arc(P, 1), burnouts: arc(P, -1) },
    questions: [],
  }
}

// Chapter detection, same rules as eras.py.
const TARGET_MONTHS = 6, MIN_MONTHS = 2, MAX_MONTHS = 12, WINDOW = 3, SPLIT_BELOW = 0.5, QUIET_MS = 3.6e6

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0
  for (const [k, v] of a) { dot += v * (b.get(k) ?? 0); na += v * v }
  for (const v of b.values()) nb += v * v
  const norm = Math.sqrt(na) * Math.sqrt(nb)
  return norm ? dot / norm : 0
}

function splitMonths(months: string[], byMonth: Map<string, Map<string, number>>): string[][] {
  // How much each month sounds like the WINDOW months before it; 0 = nothing in common.
  const score = new Map<number, number>()
  for (let i = 1; i < months.length; i++) {
    const before = new Map<string, number>()
    for (const m of months.slice(Math.max(0, i - WINDOW), i)) {
      for (const [artist, ms] of byMonth.get(m)!) before.set(artist, (before.get(artist) ?? 0) + ms)
    }
    const now = byMonth.get(months[i])!
    score.set(i, sum([...now.values()], (v) => v) < QUIET_MS ? 1 : cosine(now, before))
  }
  const edges = new Set([0, months.length])
  const fits = (i: number) => {
    const lo = Math.max(...[...edges].filter((e) => e < i)), hi = Math.min(...[...edges].filter((e) => e > i))
    return i - lo >= MIN_MONTHS && hi - i >= MIN_MONTHS
  }
  const wanted = Math.floor(months.length / TARGET_MONTHS)
  for (const i of [...score.keys()].sort((x, y) => score.get(x)! - score.get(y)! || x - y)) {
    if (edges.size - 2 >= wanted || score.get(i)! >= SPLIT_BELOW) break
    if (fits(i)) edges.add(i)
  }
  for (;;) {
    const pairs = [...edges].sort((x, y) => x - y)
    const long = pairs.slice(1).map((b, k) => [pairs[k], b]).find(([a, b]) => b - a > MAX_MONTHS)
    if (!long) break
    const [a, b] = long
    let best = a + MIN_MONTHS
    for (let i = a + MIN_MONTHS; i <= b - MIN_MONTHS; i++) {
      const key = (j: number) => [score.get(j)!, Math.abs(j - (a + b) / 2)]
      const [s1, d1] = key(i), [s0, d0] = key(best)
      if (s1 < s0 || (s1 === s0 && d1 < d0)) best = i
    }
    edges.add(best)
  }
  const pairs = [...edges].sort((x, y) => x - y)
  return pairs.slice(1).map((b, k) => months.slice(pairs[k], b))
}

type Bare = Omit<Chapter, 'title' | 'blurb' | 'mood' | 'palette'>

function stats(all: Local[], start: string, end: string, firstMonth: Map<string, string>): Bare {
  const P = all.filter((p) => p.month >= start && p.month <= end)
  const total = sum(P, (p) => p.ms)
  const fresh = new Set([...firstMonth].filter(([, m]) => m >= start && m <= end).map(([a]) => a))
  const clock = Array(24).fill(0)
  for (const p of P) clock[p.hour] += p.ms
  return {
    id: start,
    start,
    end,
    hours: round1(total / 3.6e6),
    skip_pct: pct(P, (p) => p.skipped),
    night_pct: pct(P, (p) => p.hour >= 23 || p.hour <= 4),
    top_artists: top(P, (p) => p.artist, 5).map(([name, ms]) => ({ name, minutes: Math.round(ms / 6e4) })),
    top_tracks: top(P, (p) => p.track + '\0' + p.artist, 5).map(([key, ms]) => {
      const [name, artist] = key.split('\0')
      return { name, artist, minutes: Math.round(ms / 6e4) }
    }),
    monthly: top(P, (p) => p.month, Infinity).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, ms]) => ({ month, hours: round1(ms / 3.6e6) })),
    new_artists: fresh.size,
    new_minutes_pct: total ? Math.round((100 * sum(P.filter((p) => fresh.has(p.artist)), (p) => p.ms)) / total) : 0,
    clock: clock.map((ms) => Math.round(ms / 6e4)),
    obsession: mostRepeated(P),
  }
}

function records(P: Local[]): Records {
  const days = [...new Set(P.map((p) => p.date))].sort()
  let best = { days: 0, start: days[0], end: days[0] }, run = 0, runStart = days[0]
  for (let i = 0; i < days.length; i++) {
    const consecutive = i > 0 && Date.parse(days[i]) - Date.parse(days[i - 1]) === 864e5
    if (!consecutive) { run = 0; runStart = days[i] }
    run++
    if (run > best.days) best = { days: run, start: runStart, end: days[i] }
  }
  const byDay = top(P, (p) => p.date, Infinity).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  const onDay = top(P.filter((p) => p.date === byDay[0]), (p) => p.artist, 1)[0]
  const week = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const p of P) week[p.dow][p.hour] += p.ms
  return {
    longest_streak: best,
    biggest_day: { date: byDay[0], hours: round1(byDay[1] / 3.6e6), top_artist: onDay[0] },
    most_repeated: mostRepeated(P),
    week: week.map((row) => row.map((ms) => Math.round(ms / 6e4))),
  }
}

// The track played the most times on a single day.
function mostRepeated(P: Local[]): Repeat {
  const counts = new Map<string, number>()
  for (const p of P) {
    const key = [p.track, p.artist, p.date].join('\0')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [key, plays] = [...counts].sort((a, b) => b[1] - a[1] || (a[0].split('\0')[2] < b[0].split('\0')[2] ? -1 : 1) || (a[0] < b[0] ? -1 : 1))[0]
  const [track, artist, date] = key.split('\0')
  return { track, artist, date, plays }
}

const ARC_MIN_PLAYS = 20, ARC_MIN_SHIFT = 30

// Tracks whose skip rate fell (direction 1) or rose (-1) the most between their first and second half of plays.
function arc(P: Local[], direction: 1 | -1): Arc[] {
  const byTrack = new Map<string, Local[]>()
  for (const p of P) {
    const key = p.track + '\0' + p.artist
    const list = byTrack.get(key)
    if (list) list.push(p)
    else byTrack.set(key, [p])
  }
  const out: Arc[] = []
  for (const [key, plays] of byTrack) {
    if (plays.length < ARC_MIN_PLAYS) continue
    const half = Math.ceil(plays.length / 2)
    const early = pct(plays.slice(0, half), (p) => p.skipped), late = pct(plays.slice(half), (p) => p.skipped)
    if (direction * (early - late) < ARC_MIN_SHIFT) continue
    const [track, artist] = key.split('\0')
    const months = top(plays, (p) => p.month, Infinity).map(([month]) => month).sort()
    out.push({
      track, artist, early_skip_pct: early, late_skip_pct: late, plays: plays.length,
      points: months.map((month) => {
        const m = plays.filter((p) => p.month === month)
        return { month, skip_pct: pct(m, (p) => p.skipped), plays: m.length }
      }).filter((pt) => pt.plays >= 3),
    })
  }
  const shift = (a: Arc) => direction * (a.early_skip_pct - a.late_skip_pct)
  return out.sort((a, b) => shift(b) - shift(a) || b.plays - a.plays || (a.track < b.track ? -1 : 1)).slice(0, 5)
}

// Plain titles, moods and colours for a history Claude hasn't seen.
const SEASON = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']
const PALETTES: Palette[] = [
  ['#ffd166', '#ef476f', '#06d6a0', '#fdfcdc'], ['#4cc9f0', '#4361ee', '#f72585', '#fefae0'], ['#03045e', '#0077b6', '#90e0ef', '#caf0f8'],
  ['#ff9f1c', '#ffbf69', '#2ec4b6', '#cbf3f0'], ['#7b2cbf', '#ff3cac', '#2ec4b6', '#f7f7ff'], ['#606c38', '#dda15e', '#fefae0', '#bc6c25'],
  ['#d00000', '#ffba08', '#3f88c5', '#f0ead2'], ['#9b5de5', '#f15bb5', '#fee440', '#00bbf9'], ['#1b4332', '#40916c', '#95d5b2', '#d8f3dc'],
  ['#ff006e', '#8338ec', '#ffbe0b', '#fb5607'], ['#f4a261', '#e76f51', '#264653', '#e9c46a'], ['#240046', '#5a189a', '#ff9e00', '#e0aaff'],
]

function narrate(c: Bare, first: boolean): Chapter {
  const names = c.top_artists.map((a) => a.name)
  const lead = names[0] ?? 'Nobody'
  const mid = c.monthly[Math.floor(c.monthly.length / 2)].month
  const peak = c.clock.indexOf(Math.max(...c.clock))
  const t = c.top_tracks[0]
  const when = c.start === c.end ? `in ${monthName(c.start)}` : `from ${monthName(c.start)} to ${monthName(c.end)}`
  // In the first chapter every artist is new, which is not worth saying.
  const tail = c.night_pct >= 35 ? ` ${c.night_pct}% of plays landed after 11pm.`
    : c.new_minutes_pct >= 60 && !first ? ` ${c.new_minutes_pct}% of the minutes went to artists you'd never played before.` : ''
  let hash = 0
  for (const ch of lead) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return {
    ...c,
    title: `${lead} ${SEASON[Number(mid.slice(5)) - 1]}`,
    blurb: `${c.hours} hours ${when}: ${list(names.slice(0, 3))} on top. ${t ? `${t.name} by ${t.artist} was the most-played song, and ` : ''}${hour(peak)} the busiest hour.${tail}`,
    mood: c.night_pct >= 35 ? 'Nocturnal' : c.skip_pct >= 25 ? 'Restless' : c.new_minutes_pct >= 60 ? 'Curious' : peak <= 9 ? 'Early' : 'Settled',
    palette: PALETTES[hash % PALETTES.length],
  }
}

const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '')
const monthName = (ym: string) => `${mon(ym)[0]}${mon(ym).slice(1).toLowerCase()} ${ym.slice(0, 4)}`
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((acc, x) => acc + f(x), 0)
const round1 = (x: number) => Math.round(x * 10) / 10
const pct = <T,>(xs: T[], f: (x: T) => boolean) => (xs.length ? Math.round((100 * xs.filter(f).length) / xs.length) : 0)

// Keys with the most ms, biggest first; ties by key so the result never depends on input order.
function top<T>(xs: T[], key: (x: T) => string, n: number): [string, number][] {
  const totals = new Map<string, number>()
  for (const x of xs) totals.set(key(x), (totals.get(key(x)) ?? 0) + (x as unknown as { ms: number }).ms)
  return [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n)
}
