import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Answer, Question } from './data'
import { markdown } from './markdown'
import { EASE, setEnergy, useTheme } from './theme'
import './AskPanel.css'

type Props = {
  questions: Question[]
  answer?: Question
  onAnswer: (a: Question) => void
  onClose: () => void
  pinned: boolean
  onPin: () => void
}

export function AskPanel({ questions, answer, onAnswer, onClose, pinned, onPin }: Props) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  // Without a live API there is nowhere to type, only the questions answered at build time.
  const [live, setLive] = useState<boolean>()
  const { still } = useTheme()

  useEffect(() => {
    // A dead or missing API answers with a 502 or 404 page, not JSON.
    fetch('/api/health').then((r) => r.ok && r.json()).then((h) => setLive(h && h.ask), () => setLive(false))
  }, [])

  useEffect(() => {
    if (!answer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [answer, onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true)
    setError('')
    setEnergy(1, 0.6)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const a: Answer = await res.json()
      onAnswer({ ...a, question })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setEnergy(0, 2)
    }
  }

  const chips = live === false || (focused && !question && !answer)

  return (
    <motion.div layout aria-live="polite" className={`ask ${loading ? 'loading' : ''} ${answer ? 'open' : ''}`} transition={{ duration: still ? 0 : 0.5, ease: EASE }}
      onFocus={() => setFocused(true)} onBlur={(e) => e.currentTarget.contains(e.relatedTarget) || setFocused(false)}>
      <AnimatePresence>
        {answer && (
          <motion.div className="answer" key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="mono pin" disabled={pinned} onClick={onPin}>{pinned ? 'Pinned' : 'Pin'}</button>
            <button type="button" className="close" aria-label="Close answer" onClick={onClose}>×</button>
            <p className="mood">
              {answer.mood}
              <span className="swatches">{answer.palette.map((hex, i) => <i key={i} style={{ background: hex }} />)}</span>
            </p>
            <p className="mono asked">{answer.question}</p>
            {markdown(answer.answer).map((html, i) => (
              <motion.div key={answer.answer + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: still ? 0 : 0.6, delay: still ? 0 : i * 0.08 }} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {chips && (
        // Safari doesn't focus a clicked button, so without this the input blurs and the chip is gone before the click lands.
        <div className="chips" onMouseDown={(e) => e.preventDefault()}>
          {questions.map((q) => (
            <button type="button" key={q.question} className="mono chip" onClick={() => onAnswer(q)}>{q.question}</button>
          ))}
        </div>
      )}
      {live && (
        <form onSubmit={submit} className="ask-form">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Ask about your listening"
            placeholder="Ask about your listening… what was I into last winter?" />
          <button type="submit" aria-label="Ask" disabled={loading}>
            {loading ? <span className="dots"><i /><i /><i /></span> : '→'}
          </button>
        </form>
      )}
      {error && <p className="ask-error mono">{error}</p>}
    </motion.div>
  )
}
