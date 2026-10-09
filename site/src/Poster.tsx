import { range, type Chapter } from './data'
import { accent } from './theme'
import './Poster.css'

const INK = '#f2eee6'
const INK_2 = 'rgba(242, 238, 230, 0.6)'
const DISPLAY = 'Fraunces, Georgia, serif'
const BODY = 'Inter, system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'
// Where each palette colour glows: x, y, radius.
const GLOWS = [[160, 220, 700], [940, 380, 620], [240, 1150, 640], [900, 1100, 520]]

async function save(c: Chapter, index: number) {
  // Drawn before the web fonts load, the poster comes out in Georgia.
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const g = canvas.getContext('2d')!
  const no = String(index + 1).padStart(2, '0')
  const hot = accent(c.palette)

  g.fillStyle = '#0a0a0c'
  g.fillRect(0, 0, 1080, 1350)
  g.globalCompositeOperation = 'screen'
  GLOWS.forEach(([x, y, r], i) => {
    const glow = g.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, c.palette[i])
    glow.addColorStop(1, c.palette[i] + '00')
    g.fillStyle = glow
    g.fillRect(0, 0, 1080, 1350)
  })
  g.globalCompositeOperation = 'source-over'
  const scrim = g.createLinearGradient(0, 0, 0, 1350)
  scrim.addColorStop(0, 'rgba(10, 10, 12, 0.35)')
  scrim.addColorStop(1, 'rgba(10, 10, 12, 0.7)')
  g.fillStyle = scrim
  g.fillRect(0, 0, 1080, 1350)

  const text = (s: string, x: number, y: number, font: string, fill = INK) => {
    g.font = font
    g.fillStyle = fill
    g.letterSpacing = font.includes('Mono') ? '2px' : '0px'
    g.fillText(s, x, y)
  }

  text(`CHAPTER ${no} · ${range(c.start, c.end)}`, 80, 120, `24px ${MONO}`, INK_2)
  text(c.mood, 80, 210, `italic 300 56px ${DISPLAY}`)

  // Wrap the title to 920px, three lines at most.
  g.font = `300 120px ${DISPLAY}`
  const lines = ['']
  for (const word of c.title.split(' ')) {
    const tried = `${lines.at(-1)} ${word}`.trim()
    if (g.measureText(tried).width <= 920) lines[lines.length - 1] = tried
    else lines.push(word)
  }
  lines.slice(0, 3).forEach((line, i) => text(line, 80, 350 + i * 114, `300 120px ${DISPLAY}`))

  text('TOP ARTISTS', 80, 690, `22px ${MONO}`, INK_2)
  c.top_artists.forEach((a, i) => {
    text(`0${i + 1}`, 80, 750 + i * 62, `22px ${MONO}`, hot)
    text(a.name, 140, 750 + i * 62, `500 38px ${BODY}`)
  })

  const stats = [[c.hours, 'HOURS'], [`${c.new_minutes_pct}%`, 'NEW MUSIC'], [`${c.night_pct}%`, 'AFTER 11PM']]
  stats.forEach(([value, label], i) => {
    text(String(value), 80 + i * 340, 1150, `300 88px ${DISPLAY}`)
    text(String(label), 80 + i * 340, 1195, `22px ${MONO}`, INK_2)
  })

  c.palette.forEach((hex, i) => {
    g.fillStyle = hex
    g.beginPath()
    g.arc(87 + i * 24, 1280, 7, 0, Math.PI * 2)
    g.fill()
  })
  g.textAlign = 'right'
  text('chapters', 1000, 1290, `300 36px ${DISPLAY}`)

  canvas.toBlob((blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob!)
    a.download = `chapters-${no}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  })
}

export function PosterButton({ chapter, index }: { chapter: Chapter; index: number }) {
  return <button type="button" className="mono poster" aria-label={`Save poster for ${chapter.title}`} onClick={() => save(chapter, index)}>Save poster</button>
}
