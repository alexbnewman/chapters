import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Arcs } from './Arcs'
import { AskPanel } from './AskPanel'
import { Background } from './Background'
import { Chapter } from './Chapter'
import type { Data, Question } from './data'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { How } from './How'
import { Loading } from './Loading'
import { Postcards } from './Postcards'
import { Records } from './Records'
import { Rail } from './Rail'
import { setPalette, setPaused, useTheme } from './theme'

const KEY = 'chapters.postcards'

// Browsers that block site storage throw on any localStorage access; without this the whole page is blank.
function saved(): Question[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export default function App() {
  const [data, setData] = useState<Data>()
  const [failed, setFailed] = useState(false)
  // `tint` is whose colours the page wears; `at` is the chapter the rail marks. The closing
  // sections borrow a chapter's colours without moving the rail back to it.
  const [tint, setTint] = useState(0)
  const [at, setAt] = useState(0)
  const [answer, setAnswer] = useState<Question>()
  // An answer's palette overrides the chapters' until the reader scrolls a fifth of a screen away.
  const [override, setOverride] = useState<Question & { y: number }>()
  const [cards, setCards] = useState<Question[]>(saved)
  const { still } = useTheme()

  useEffect(() => {
    fetch('./chapters.json').then((r) => r.json()).then(setData, () => setFailed(true))
  }, [])

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(cards)) } catch { /* storage blocked: pins last for this visit only */ } }, [cards])

  useEffect(() => {
    if (!data) return
    const c = override ?? data.chapters[tint]
    setPalette(c.palette)
  }, [data, tint, override])

  useEffect(() => {
    if (!override) return
    const onScroll = () => Math.abs(scrollY - override.y) > innerHeight * 0.2 && setOverride(undefined)
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [override])

  const onChapter = useCallback((i: number) => {
    setTint(i)
    setAt(i)
  }, [])

  // The closing sections sit after the last chapter, so the rail parks on its last dot. Without
  // this, jumping straight to the end leaves the rail on whatever chapter you jumped from.
  const onSection = useCallback((i: number) => {
    setTint(i)
    setAt(Infinity)
  }, [])

  const show = useCallback((a: Question) => {
    setAnswer(a)
    setOverride({ ...a, y: scrollY })
  }, [])

  return (
    <MotionConfig reducedMotion={still ? 'always' : 'never'}>
      <Background />
      <button type="button" className="mono pause" onClick={() => setPaused(!still)}>
        {still ? 'Resume motion' : 'Pause motion'}
      </button>
      {data ? (
        <>
          <main>
            <Hero overview={data.overview} onActive={onChapter} />
            {data.chapters.map((c, i) => (
              <Chapter key={c.id} chapter={c} index={i} onActive={onChapter} />
            ))}
            <Arcs arcs={data.arcs} chapters={data.chapters} onActive={onSection} />
            <Records records={data.records} chapters={data.chapters} onActive={onSection} />
            {cards.length > 0 && (
              <Postcards cards={cards} tint={data.chapters.length - 1} onActive={onSection} onOpen={show}
                onRemove={(card) => setCards(cards.filter((c) => c !== card))} />
            )}
            <How tint={data.chapters.length - 1} onActive={onSection} />
            <Footer tz={data.overview.tz} />
          </main>
          <Rail chapters={data.chapters} active={Math.min(at, data.chapters.length - 1)} />
          <AskPanel questions={data.questions} answer={answer} onAnswer={show} onClose={() => setAnswer(undefined)}
            pinned={cards.some((c) => c.question === answer?.question && c.answer === answer.answer)}
            onPin={() => answer && setCards([...cards, answer])} />
        </>
      ) : <Loading failed={failed} />}
    </MotionConfig>
  )
}
