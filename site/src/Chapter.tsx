import { motion } from 'motion/react'
import { useRef } from 'react'
import { mon, range, span, type Chapter as ChapterData } from './data'
import { Extras } from './Extras'
import { Numeral } from './Numeral'
import { PosterButton } from './Poster'
import { EASE, ONCE, SPRING, useActive, useFade, useTheme } from './theme'

type Props = { chapter: ChapterData; index: number; onActive: (i: number) => void }

export function Chapter({ chapter: c, index, onActive }: Props) {
  const ref = useRef<HTMLElement>(null)
  const fade = useFade()
  useActive(ref, index, onActive)

  const maxArtist = Math.max(...c.top_artists.map((a) => a.minutes))
  const maxTrack = Math.max(...c.top_tracks.map((t) => t.minutes))
  const maxMonth = Math.max(...c.monthly.map((m) => m.hours))
  const n = c.monthly.length

  return (
    <section ref={ref} id={c.id} className="chapter">
      <div className="chapter-grid">
        <div className="chapter-text">
          <motion.p className="mono" {...fade(0)}>Chapter {String(index + 1).padStart(2, '0')} · {range(c.start, c.end)}</motion.p>
          <motion.p className="mood" {...fade(1)}>
            {c.mood}
            <span className="swatches">{c.palette.map((hex, i) => <i key={i} style={{ background: hex }} />)}</span>
          </motion.p>
          <motion.h2 className="display chapter-title" {...fade(2)}>{c.title}</motion.h2>
          <motion.p className="blurb" {...fade(3)}>{c.blurb}</motion.p>
          <PosterButton chapter={c} index={index} />
          <Extras chapter={c} />
        </div>

        <div className="card chapter-data">
          <p className="mono">Top artists</p>
          <ol className="rows">
            {c.top_artists.map((a, i) => (
              <li key={a.name}>
                <span className="row-name">{a.name}</span>
                <span className="mono">{span(a.minutes)}</span>
                <motion.span className="bar" style={{ width: `${(a.minutes / maxArtist) * 100}%` }}
                  initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={ONCE} transition={{ ...SPRING, delay: i * 0.04 }} />
              </li>
            ))}
          </ol>

          <p className="mono">Top tracks</p>
          <ol className="rows tracks">
            {c.top_tracks.map((t, i) => (
              <li key={t.name + t.artist}>
                <span className="row-name">{t.name} <span className="dim">{t.artist}</span></span>
                <span className="mono">{span(t.minutes)}</span>
                <motion.span className="bar mini" style={{ width: `${(t.minutes / maxTrack) * 60}px` }}
                  initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={ONCE} transition={{ ...SPRING, delay: i * 0.04 }} />
              </li>
            ))}
          </ol>

          <p className="mono">Hours by month</p>
          <svg className="months" viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" role="img"
            aria-label={`Hours by month: ${c.monthly.map((m) => `${mon(m.month)} ${m.hours}`).join(', ')}`}>
            {c.monthly.map((m, i) => {
              const h = m.hours / maxMonth
              return <motion.rect key={m.month} x={i + 0.15} width={0.7} fill="var(--c3)" fillOpacity={h === 1 ? 1 : 0.55}
                initial={{ y: 1, height: 0 }} whileInView={{ y: 1 - h, height: h }} viewport={ONCE} transition={{ ...SPRING, delay: i * 0.04 }} />
            })}
          </svg>
          <div className="month-labels mono" aria-hidden style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {c.monthly.map((m) => <span key={m.month}>{mon(m.month)}</span>)}
          </div>
        </div>
      </div>

      <div className="stats">
        <div>
          <Numeral value={c.hours} decimals={1} className="stat-hours" />
          <p className="mono">hours</p>
        </div>
        <Ring pct={c.skip_pct} label="skipped" />
        <Ring pct={c.night_pct} label="night plays" />
      </div>
    </section>
  )
}

const C = 2 * Math.PI * 42

function Ring({ pct, label }: { pct: number; label: string }) {
  const { still } = useTheme()
  return (
    <div className="ring">
      <svg viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <motion.circle cx="48" cy="48" r="42" fill="none" stroke="var(--c3)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} whileInView={{ strokeDashoffset: C * (1 - pct / 100) }}
          viewport={ONCE} transition={{ duration: still ? 0 : 1.2, ease: EASE }} />
      </svg>
      <span className="ring-num">
        <Numeral value={Math.round(pct)} /><span className="pct">%</span>
      </span>
      <p className="mono">{label}</p>
    </div>
  )
}
