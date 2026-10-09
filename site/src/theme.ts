import { animate, type AnimationPlaybackControls } from 'motion'
import { useInView } from 'motion/react'
import { useEffect, useSyncExternalStore, type RefObject } from 'react'

export type Palette = [string, string, string, string]
export type Rgb = [number, number, number]

type Theme = { still: boolean }

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const SPRING = { type: 'spring', stiffness: 120, damping: 20 } as const
export const ONCE = { once: true, amount: 0.3 }
const BG = '#0a0a0c'

const listeners = new Set<() => void>()
const mq = matchMedia('(prefers-reduced-motion: reduce)')
// Starts from the OS setting, but the Pause/Resume button has the last word; otherwise the
// button does nothing for someone whose system asks for reduced motion.
let paused = mq.matches
let theme: Theme = { still: paused }
mq.addEventListener('change', () => setPaused(mq.matches))

// What the shader reads every frame: settled palette A, incoming B, and how far the crossfade is.
// Colors are linear RGB so the GPU mix doesn't go muddy in the middle.
export const blend = { a: [] as Rgb[], b: [] as Rgb[], mix: 0 }
blend.a = blend.b = [BG, BG, BG, BG].map(toLinear)

// Mood energy lives outside React state so its per-frame tween doesn't re-render the page.
export const energy = { value: 0 }

// Same shape as a MediaQueryList so the shader and fades treat the manual toggle like the OS setting.
export const reducedMotion = { get matches() { return paused } }

let running: AnimationPlaybackControls | undefined
let energyRun: AnimationPlaybackControls | undefined

export function setPalette(palette: Palette) {
  const sorted = byLuminance(palette)
  running?.stop()
  // Retarget from wherever the crossfade currently is, so a mid-fade change doesn't jump.
  blend.a = blend.a.map((c, i) => c.map((v, k) => v + (blend.b[i][k] - v) * blend.mix) as Rgb)
  blend.b = sorted.map(toLinear)
  blend.mix = 0
  running = animate(0, 1, {
    duration: reducedMotion.matches ? 0.3 : 1.5,
    ease: EASE,
    onUpdate: (v) => (blend.mix = v),
    onComplete: () => {
      blend.a = blend.b
      blend.mix = 0
    },
  })
  const root = document.documentElement.style
  sorted.forEach((hex, i) => root.setProperty(`--c${i}`, hex))
  root.setProperty('--c3', accent(sorted))
  // A mid-tone title only when it's readable; otherwise fall back to the lifted accent.
  root.setProperty('--title', contrast(sorted[2]) >= 3 ? sorted[2] : accent(sorted))
}

export function setEnergy(to: number, duration = 0) {
  energyRun?.stop()
  energyRun = animate(energy.value, to, { duration, onUpdate: (v) => (energy.value = v) })
}

export function setPaused(v: boolean) {
  paused = v
  emit({ still: paused })
}

// The brightest stop, lifted toward white until it reads at 4.5:1 on the base background.
export function accent(palette: Palette) {
  const hex = byLuminance(palette)[3]
  let t = 0
  while (contrast(mixWhite(hex, t)) < 4.5 && t < 1) t += 0.05
  return mixWhite(hex, t)
}

function byLuminance(palette: Palette) {
  return [...palette].sort((x, y) => luminance(toLinear(x)) - luminance(toLinear(y))) as Palette
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => theme)
}

// The shared entrance: rise and fade in, staggered by i. With motion off it is a quick fade.
export function useFade() {
  const { still } = useTheme()
  return (i: number) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: ONCE,
    transition: { duration: still ? 0.2 : 0.9, ease: EASE, delay: still ? 0 : i * 0.06 },
  })
}

// Reports `index` while the element crosses the middle of the screen. A "55% visible" rule
// never fires for something taller than the screen, which is every chapter on a phone.
export function useActive(ref: RefObject<Element | null>, index: number, onActive: (i: number) => void) {
  const inView = useInView(ref, { margin: '-50% 0px -50% 0px' })

  // 150ms debounce so a fast scroll past doesn't flash this palette.
  useEffect(() => {
    if (!inView) return
    const id = setTimeout(() => onActive(index), 150)
    return () => clearTimeout(id)
  }, [inView, index, onActive])
}

function emit(next: Theme) {
  theme = next
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function toLinear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => ((v / 255) ** 2.2)) as Rgb
}

function luminance([r, g, b]: Rgb) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const BG_L = luminance(toLinear(BG))
function contrast(hex: string) {
  return (luminance(toLinear(hex)) + 0.05) / (BG_L + 0.05)
}

function mixWhite(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  return '#' + [n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'))
    .join('')
}
