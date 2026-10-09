import { motion } from 'motion/react'
import { hour } from './data'
import { ONCE, useFade, useTheme } from './theme'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Minutes listened by weekday (rows, Monday first) and hour (columns), whole history.
export function Week({ week }: { week: number[][] }) {
  const { still } = useTheme()
  const fade = useFade()
  const max = Math.max(...week.flat())
  const hotDay = week.findIndex((row) => row.includes(max))
  const hotHour = week[hotDay].indexOf(max)
  const caption = `Your loudest hour: ${DAYS[hotDay]}s at ${hour(hotHour)}.`

  return (
    <motion.div className="card week" {...fade(3)}>
      <p className="mono">Your week</p>
      <motion.svg viewBox="0 0 250 76" role="img" aria-label={caption} initial="off" whileInView="on" viewport={ONCE}>
        {week.map((row, d) => (
          <g key={d}>
            <text x="0" y={d * 9.5 + 6.2}>{DAYS[d][0]}</text>
            {row.map((v, h) => (
              <motion.rect key={h} x={22 + h * 9.5} y={d * 9.5} width="9" height="9" rx="2"
                className={d === hotDay && h === hotHour ? 'week-hot' : undefined}
                fillOpacity={0.06 + 0.94 * Math.sqrt(v / max)}
                variants={{ off: { opacity: 0 }, on: { opacity: 1 } }}
                transition={still ? { duration: 0.2 } : { duration: 0.4, delay: (d + h) * 0.012 }} />
            ))}
          </g>
        ))}
        {[0, 6, 12, 18].map((h) => <text key={h} x={22 + h * 9.5} y="74">{String(h).padStart(2, '0')}</text>)}
      </motion.svg>
      <p className="week-caption">{caption}</p>
    </motion.div>
  )
}
