import { motion } from 'motion/react'
import { Section } from './Section'
import { useFade } from './theme'
import './How.css'

const STEPS = [
  ['Export', 'You ask Spotify for your extended streaming history and drop the zip on this page, or the files in a folder.'],
  ['Find the chapters', 'DuckDB loads every play, and the months get grouped into chapters.'],
  ['Name them', "Claude reads each chapter's stats, gives it a title, mood and colours, and answers your questions by looking things up through MCP tools. A zip dropped on this page gets plain titles instead, since nothing here leaves your browser."],
]

export function How({ tint, onActive }: { tint: number; onActive: (i: number) => void }) {
  const fade = useFade()
  return (
    <Section id="how" label="Behind the page" title="How this works" tint={tint} onActive={onActive}>
      <div className="how">
        {STEPS.map(([name, text], i) => (
          <motion.div key={name} {...fade(i)}>
            <p className="display how-num">{String(i + 1).padStart(2, '0')}</p>
            <h3>{name}</h3>
            <p>{text}</p>
          </motion.div>
        ))}
      </div>
      <p className="dim how-rule">A new chapter starts where a month sounds least like the three before it, about one every six months.</p>
    </Section>
  )
}
