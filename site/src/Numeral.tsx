import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import { EASE, useTheme } from './theme'

// Counts up from 0 once it scrolls into view. A hidden copy of the final number holds the
// width, so the number never nudges its neighbours while ticking.
export function Numeral({ value, decimals = 0, className = '' }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const { still } = useTheme()
  const mv = useMotionValue(still ? value : 0)
  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const text = useTransform(mv, fmt)

  useEffect(() => {
    if (!inView) return
    if (still) return mv.set(value)
    const run = animate(mv, value, { duration: 1.2, ease: EASE })
    return () => run.stop()
  }, [inView, still, value, mv])

  return (
    <span ref={ref} className={`display num ${className}`}>
      <span className="num-hold" aria-hidden>{fmt(value)}</span>
      <motion.span className="num-live">{text}</motion.span>
    </span>
  )
}
