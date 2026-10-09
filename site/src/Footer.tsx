import './Footer.css'

export function Footer({ tz }: { tz: string }) {
  return (
    <footer className="footer mono">
      <span>Chapters</span>
      <span>Times in {tz} · Your history stays on this machine</span>
    </footer>
  )
}
