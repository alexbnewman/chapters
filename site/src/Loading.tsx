import { useTheme } from './theme'
import './Loading.css'

export function Loading({ failed }: { failed: boolean }) {
  const { still } = useTheme()
  return (
    <div className={`loading ${still || failed ? 'still' : ''}`} role="status">
      <p className="display loading-title">Chapters</p>
      {failed
        ? <p className="mono loading-error">Couldn't find chapters.json. Run <code>chapters build</code> first.</p>
        : <p className="mono">Reading your history…</p>}
    </div>
  )
}
