// Markdown-lite: one HTML string per block (paragraph or list). Everything is escaped first so a
// model answer can't inject markup.
export function markdown(md: string): string[] {
  return md
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim())
      if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`
      if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`
      return `<p>${inline(lines.join(' '))}</p>`
    })
}

function inline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])[*_](.+?)[*_](?=[^*\w]|$)/g, '$1<em>$2</em>')
}
