import type { Palette } from './theme'

export type Chapter = {
  id: string
  start: string
  end: string
  title: string
  blurb: string
  mood: string
  palette: Palette
  hours: number
  top_artists: { name: string; minutes: number }[]
  top_tracks: { name: string; artist: string; minutes: number }[]
  monthly: { month: string; hours: number }[]
  skip_pct: number
  night_pct: number
  new_artists: number
  clock: number[]
  new_minutes_pct: number
  obsession: Repeat
}

// One track played over and over on one day.
export type Repeat = { track: string; artist: string; date: string; plays: number }

export type Overview = {
  first_play: string
  last_play: string
  plays: number
  hours: number
  artists: number
  tz: string
  tracks: number
  days_listened: number
}

export type Records = {
  longest_streak: { days: number; start: string; end: string }
  biggest_day: { date: string; hours: number; top_artist: string }
  most_repeated: Repeat
  week: number[][]
}

export type Arc = {
  track: string
  artist: string
  early_skip_pct: number
  late_skip_pct: number
  plays: number
  points: { month: string; skip_pct: number; plays: number }[]
}

export type Answer = { answer: string; mood: string; palette: Palette }
export type Question = Answer & { question: string }

export type Data = {
  overview: Overview
  chapters: Chapter[]
  records: Records
  arcs: { redemptions: Arc[]; burnouts: Arc[] }
  questions: Question[]
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export const mon = (ym: string) => MON[Number(ym.slice(5)) - 1]

// "JAN–APR 2023", "NOV 2023–FEB 2024" across a year, or just "AUG 2024" for a one-month chapter.
export function range(start: string, end: string) {
  const sy = start.slice(0, 4), ey = end.slice(0, 4)
  if (start === end) return `${mon(start)} ${sy}`
  return `${mon(start)}${sy === ey ? '' : ' ' + sy}–${mon(end)} ${ey}`
}

// "2021-03-14" -> "14 Mar 2021"
export function day(iso: string) {
  const [y, m, d] = iso.split('-')
  const name = MON[Number(m) - 1]
  return `${Number(d)} ${name[0]}${name.slice(1).toLowerCase()} ${y}`
}

// 23 -> "11pm", 0 -> "12am"
export const hour = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`

// Minutes as text; from two hours up they read better as hours.
export const span = (min: number) => (min >= 120 ? `${(min / 60).toFixed(1)} h` : `${min} min`)

// Index of the chapter a date ("2022-03-01") or month ("2022-03") falls in.
export const chapterAt = (chapters: Chapter[], iso: string) =>
  chapters.findIndex((c) => c.start <= iso.slice(0, 7) && iso.slice(0, 7) <= c.end)
