import { useRef } from 'react'
import { day, type Overview } from './data'
import { Numeral } from './Numeral'
import { useActive } from './theme'

type Props = { overview: Overview; onActive: (i: number) => void; status: string }

export function Hero({ overview, onActive, status }: Props) {
  const ref = useRef<HTMLElement>(null)
  // Without this, scrolling back to the top leaves the page in the last chapter's colours.
  useActive(ref, 0, onActive)

  return (
    <header ref={ref} className="hero">
      <p className="mono">First play {day(overview.first_play)} · Last play {day(overview.last_play)}</p>
      <div className="hero-foot">
        <div className="hero-stats">
          <Stat value={overview.plays} label="plays" />
          <Stat value={overview.hours} decimals={1} label="hours" />
          <Stat value={overview.artists} label="artists" />
          <Stat value={overview.tracks} label="tracks" />
          <Stat value={overview.days_listened} label="days listened" />
        </div>
        <h1 className="display hero-title">Chapters</h1>
        <p className="mono hero-scroll">Scroll to read it ↓</p>
        {status && <p className="mono hero-own">{status === 'reading' ? 'Reading your export…' : status}</p>}
      </div>
    </header>
  )
}

function Stat({ value, label, decimals }: { value: number; label: string; decimals?: number }) {
  return (
    <div>
      <Numeral value={value} decimals={decimals} className="hero-num" />
      <p className="mono">{label}</p>
    </div>
  )
}
