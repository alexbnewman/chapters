import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { hour } from './data'
import { ONCE, SPRING, useTheme } from './theme'
import './Clock.css'

// Hour 0 points straight up and hours run clockwise, 15 degrees each.
function at(h: number, r: number) {
  const a = (h * 15 * Math.PI) / 180
  return [180 + r * Math.sin(a), 180 - r * Math.cos(a)]
}

const [NX1, NY1] = at(23, 80)
const [NX2, NY2] = at(5, 80)

export function Clock({ clock }: { clock: number[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, ONCE)
  const { still } = useTheme()
  const max = Math.max(...clock)
  const peak = hour(clock.indexOf(max))

  return (
    <svg ref={ref} className="clock" viewBox="0 0 360 360" role="img" aria-label={`Listening by hour, peak ${peak}`}>
      <circle className="clock-track" cx="180" cy="180" r="80" />
      <path className="clock-night" d={`M${NX1} ${NY1}A80 80 0 0 1 ${NX2} ${NY2}`} />
      {clock.map((v, h) => {
        const [x1, y1] = at(h, 88)
        // A silent hour keeps a 2px stub so the dial still reads as 24 hours.
        const [x2, y2] = at(h, 88 + Math.max(62 * (v / max), 2))
        return (
          <motion.line key={h} className="clock-bar" x1={x1} y1={y1} strokeOpacity={0.4 + 0.6 * (v / max)}
            initial={still ? { x2, y2, opacity: 0 } : { x2: x1, y2: y1, opacity: 0 }}
            animate={inView && { x2, y2, opacity: 1 }}
            transition={still ? { duration: 0.2 } : { ...SPRING, delay: h * 0.05 }} />
        )
      })}
      {inView && <line className="clock-hand" visibility={still ? 'hidden' : undefined} x1="180" y1="92" x2="180" y2="30" />}
      <text className="clock-label" x="180" y="10">00</text>
      <text className="clock-label" x="350" y="180">06</text>
      <text className="clock-label" x="180" y="350">12</text>
      <text className="clock-label" x="10" y="180">18</text>
      <text className="clock-label clock-word" x="180" y="22">MIDNIGHT</text>
      <text className="clock-label clock-word" x="180" y="338">NOON</text>
      <motion.g initial={{ opacity: 0 }} animate={inView && { opacity: 1 }}
        transition={still ? { duration: 0.2 } : { duration: 0.4, delay: 1.2 }}>
        <text className="clock-peak" x="180" y="190">{peak}</text>
        <text className="clock-label" x="180" y="214">PEAK HOUR</text>
      </motion.g>
    </svg>
  )
}
