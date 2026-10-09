import { motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { useActive, useFade } from './theme'
import './Section.css'

type Props = {
  id: string
  label: string
  title: string
  // Index of the chapter whose colours this section borrows while it is on screen.
  tint: number
  onActive: (i: number) => void
  children: ReactNode
}

export function Section({ id, label, title, tint, onActive, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  const fade = useFade()
  useActive(ref, tint, onActive)

  return (
    <section ref={ref} id={id} className="section">
      <motion.p className="mono" {...fade(0)}>{label}</motion.p>
      <motion.h2 className="display section-title" {...fade(1)}>{title}</motion.h2>
      {children}
    </section>
  )
}
