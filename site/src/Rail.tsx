import type { KeyboardEvent } from 'react'
import type { Chapter } from './data'
import { accent, useTheme } from './theme'
import './Rail.css'

// Up and down arrows walk the dots. Only the current dot takes Tab, so a keyboard reader
// isn't made to press it once per chapter.
function onKey(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  const dot = document.activeElement?.[e.key === 'ArrowUp' ? 'previousElementSibling' : 'nextElementSibling']
  if (dot instanceof HTMLElement) dot.focus()
}

export function Rail({ chapters, active }: { chapters: Chapter[]; active: number }) {
  const { still } = useTheme()
  return (
    <nav className={`rail ${still ? 'still' : ''}`} aria-label="Chapters" onKeyDown={onKey}>
      {chapters.map((c, i) => (
        <button key={c.id} type="button" aria-current={i === active || undefined} tabIndex={i === active ? 0 : -1}
          onClick={() => document.getElementById(c.id)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })}>
          <i style={{ background: accent(c.palette) }} />
          <span className="rail-label">
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>{c.title}
          </span>
        </button>
      ))}
    </nav>
  )
}
