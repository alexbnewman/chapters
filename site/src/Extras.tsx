import { motion } from 'motion/react'
import { Clock } from './Clock'
import { day, type Chapter } from './data'
import { EASE, ONCE, SPRING, useFade, useTheme } from './theme'
import './Extras.css'

const POP = { off: { scale: 0, opacity: 0 }, on: { scale: 1, opacity: 1 } }
const DRAW = { off: { scaleY: 0, opacity: 0 }, on: { scaleY: 1, opacity: 1 } }

export function Extras({ chapter: c }: { chapter: Chapter }) {
  const { still } = useTheme()
  const fade = useFade()
  const filled = Math.round(c.new_minutes_pct / 5)
  const o = c.obsession

  return (
    <motion.div className="chapter-extras" {...fade(4)}>
      <Clock clock={c.clock} />
      <div className="extras-side">
        <div>
          <p className="mono">Curiosity</p>
          <motion.div className="curiosity-dots" initial="off" whileInView="on" viewport={ONCE} aria-hidden>
            {Array.from({ length: 20 }, (_, i) => i < filled
              ? <motion.i key={i} className="on" variants={POP} transition={still ? { duration: 0.2 } : { ...SPRING, delay: i * 0.03 }} />
              : <i key={i} />)}
          </motion.div>
          <p className="curiosity-line">
            <span className="display">{c.new_minutes_pct}%</span> of your listening was music you'd never played before
          </p>
          <p className="mono">{c.new_artists} new {c.new_artists === 1 ? 'artist' : 'artists'}</p>
        </div>
        <div>
          <p className="mono">Obsession</p>
          <p className="obsession-track">{o.track}</p>
          <p className="dim obsession-artist">{o.artist}</p>
          <motion.div className="tally" initial="off" whileInView="on" viewport={ONCE} aria-hidden>
            {Array.from({ length: o.plays }, (_, i) => (
              <motion.i key={i} variants={DRAW} transition={still ? { duration: 0.2 } : { duration: 0.25, ease: EASE, delay: i * 0.015 }} />
            ))}
          </motion.div>
          <p className="mono">{o.plays} plays on {day(o.date)}</p>
        </div>
      </div>
    </motion.div>
  )
}
