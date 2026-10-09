import { motion } from 'motion/react'
import { useId } from 'react'
import { type Arc, type Chapter, type Data } from './data'
import { Section } from './Section'
import { EASE, ONCE, useTheme } from './theme'
import './Arcs.css'

type Props = { arcs: Data['arcs']; chapters: Chapter[]; onActive: (i: number) => void }

export function Arcs({ arcs, chapters, onActive }: Props) {
  const lead = arcs.redemptions[0] ?? arcs.burnouts[0]
  if (!lead) return null
  const tint = chapters.length - 1

  return (
    <Section id="arcs" label="Skips, then and now" title="The songs that changed" tint={tint} onActive={onActive}>
      <div className="arcs">
        {arcs.redemptions.length > 0 && (
          <div>
            <h3>Grew on you</h3>
            {arcs.redemptions.map((a, i) => <Row key={a.track + a.artist} arc={a} i={i} up />)}
          </div>
        )}
        {arcs.burnouts.length > 0 && (
          <div>
            <h3>Wore out</h3>
            {arcs.burnouts.map((a, i) => <Row key={a.track + a.artist} arc={a} i={i} />)}
          </div>
        )}
      </div>
    </Section>
  )
}

function Row({ arc, i, up = false }: { arc: Arc; i: number; up?: boolean }) {
  const { still } = useTheme()
  const delay = still ? 0 : i * 0.06
  const row = {
    off: { opacity: 0, y: 24 },
    on: {
      opacity: 1,
      y: 0,
      transition: {
        y: { duration: 0.9, ease: EASE, delay },
        opacity: still ? { duration: 0.2 } : { duration: 0.9, ease: EASE, delay },
      },
    },
  }

  return (
    <motion.div className="arc" variants={row} initial="off" whileInView="on" viewport={ONCE}>
      <div>
        <p className="arc-name">{arc.track}</p>
        <p className="dim">{arc.artist}</p>
        <p className="mono">Skipped {arc.early_skip_pct}% → {arc.late_skip_pct}% · {arc.plays} plays</p>
      </div>
      {/* One month of data is a dot, not a line. */}
      {arc.points.length > 1 && <Spark arc={arc} up={up} delay={delay} />}
    </motion.div>
  )
}

// The line plots the share of plays that were kept, so a song that grew on you climbs.
function Spark({ arc, up, delay }: { arc: Arc; up: boolean; delay: number }) {
  const id = useId()
  const { still } = useTheme()
  const step = 164 / (arc.points.length - 1)
  const pts = arc.points.map((p, i) => [2 + i * step, 44 - 40 * ((100 - p.skip_pct) / 100)])
  const [ex, ey] = pts[pts.length - 1]
  const [px, py] = pts[pts.length - 2]
  // A worn-out line stops one point early; its last stretch is drawn dashed.
  const solid = (up ? pts : pts.slice(0, -1)).map((p) => p.join(',')).join(' ')

  const line = still
    ? { off: { pathLength: 1, opacity: 0 }, on: { pathLength: 1, opacity: 1, transition: { duration: 0.2 } } }
    : { off: { pathLength: 0, opacity: 0 }, on: { pathLength: 1, opacity: 1, transition: { pathLength: { duration: 1, ease: EASE, delay }, opacity: { duration: 0.01, delay } } } }
  const end = {
    off: { scale: still ? 1 : 0, opacity: 0 },
    on: { scale: 1, opacity: 1, transition: still ? { duration: 0.2 } : { duration: 0.3, ease: EASE, delay: delay + 0.9 } },
  }

  return (
    <svg className="spark" viewBox="0 0 168 48" aria-hidden>
      <defs>
        {/* userSpaceOnUse: the default box-relative gradient vanishes on a perfectly flat line. */}
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2="168">
          <stop offset="0" className={up ? 'spark-faint' : 'spark-full'} />
          <stop offset="1" className={up ? 'spark-full' : 'spark-gone'} />
        </linearGradient>
      </defs>
      <motion.polyline points={solid} stroke={`url(#${id})`} variants={line} />
      {up ? (
        <motion.g variants={end}>
          <circle className="spark-glow" cx={ex} cy={ey} r="10" />
          <circle className="spark-dot" cx={ex} cy={ey} r="4" />
        </motion.g>
      ) : (
        <motion.g variants={end}>
          <line x1={px} y1={py} x2={ex} y2={ey} stroke={`url(#${id})`} strokeDasharray="2 4" />
          <circle className="spark-ring" cx={ex} cy={ey} r="4" />
        </motion.g>
      )}
    </svg>
  )
}
