import { AnimatePresence, motion } from 'motion/react'
import type { Question } from './data'
import { Section } from './Section'
import { SPRING, useTheme } from './theme'
import './Postcards.css'

type Props = {
  cards: Question[]
  tint: number
  onActive: (i: number) => void
  onOpen: (card: Question) => void
  onRemove: (card: Question) => void
}

export function Postcards({ cards, tint, onActive, onOpen, onRemove }: Props) {
  const { still } = useTheme()
  return (
    <Section id="postcards" label="Answers you pinned" title="Postcards" tint={tint} onActive={onActive}>
      <div className="postcards">
        <AnimatePresence>
          {cards.map((card, i) => {
            const [p0, p1, p2] = card.palette
            const rotate = still ? 0 : i % 2 ? 1.5 : -1.5
            return (
              <motion.div key={card.question + card.answer} className="postcard"
                style={{ background: `linear-gradient(rgba(10, 10, 12, 0.55), rgba(10, 10, 12, 0.55)), linear-gradient(135deg, ${p0}, ${p1} 55%, ${p2})` }}
                initial={{ opacity: 0, scale: 0.9, rotate }} animate={{ opacity: 1, scale: 1, rotate }}
                exit={{ opacity: 0, scale: 0.9 }} whileHover={{ rotate: 0 }} transition={still ? { duration: 0.2 } : SPRING}>
                <button type="button" className="postcard-open" onClick={() => onOpen(card)}>
                  <span className="postcard-mood">{card.mood}</span>
                  <span className="swatches">{card.palette.map((hex, k) => <i key={k} style={{ background: hex }} />)}</span>
                  <span className="mono">{card.question}</span>
                  <span className="postcard-answer">{card.answer.replace(/\*/g, '')}</span>
                </button>
                <button type="button" className="postcard-remove" aria-label={`Remove postcard: ${card.question}`} onClick={() => onRemove(card)}>×</button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Section>
  )
}
