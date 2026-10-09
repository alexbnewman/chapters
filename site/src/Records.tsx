import { motion } from 'motion/react'
import { chapterAt, day, type Chapter, type Records as RecordsData } from './data'
import { Numeral } from './Numeral'
import { Section } from './Section'
import { useFade } from './theme'
import { Week } from './Week'
import './Records.css'

type Props = { records: RecordsData; chapters: Chapter[]; onActive: (i: number) => void }

export function Records({ records: r, chapters, onActive }: Props) {
  const fade = useFade()
  const s = r.longest_streak
  // "1 Mar – 4 May 2022": the first year is dropped when both ends share it.
  const from = s.start.slice(0, 4) === s.end.slice(0, 4) ? day(s.start).slice(0, -5) : day(s.start)

  return (
    <Section id="records" label="The whole history" title="Records" tint={chapterAt(chapters, s.start)} onActive={onActive}>
      <div className="records">
        <motion.div className="card" {...fade(0)}>
          <p className="mono">Longest streak</p>
          <Numeral value={s.days} className="record-num" />
          <p>days in a row</p>
          <p className="mono">{from} – {day(s.end)}</p>
        </motion.div>
        <motion.div className="card" {...fade(1)}>
          <p className="mono">Biggest day</p>
          <Numeral value={r.biggest_day.hours} decimals={1} className="record-num" />
          <p>hours on {day(r.biggest_day.date)}, mostly {r.biggest_day.top_artist}</p>
        </motion.div>
        <motion.div className="card" {...fade(2)}>
          <p className="mono">Most repeated</p>
          <Numeral value={r.most_repeated.plays} className="record-num" />
          <p>plays of {r.most_repeated.track} by {r.most_repeated.artist} in one day</p>
          <p className="mono">{day(r.most_repeated.date)}</p>
        </motion.div>
      </div>
      <Week week={r.week} />
    </Section>
  )
}
