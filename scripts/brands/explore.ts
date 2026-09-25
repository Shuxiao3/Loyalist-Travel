// Prints the links and images on a page that look like brand assets, so a
// press kit can be read from the workflow runner (this sandbox cannot reach
// hotel sites). Usage: npm run fetch:brand-logos -- --explore <url>
const UA = 'LoyalistTravelBot/1.0 (https://www.loyalisttravel.com; brand logos for hotel program pages)'

export async function explore(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
  console.log(`explore: ${url} -> ${res.status} ${res.headers.get('content-type') ?? ''}`)
  const html = await res.text()
  const base = new URL(res.url || url)
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of html.matchAll(/<(a|img|source)\b[^>]*?(?:href|src|srcset|data-src)=["']([^"']+)["'][^>]*>/gi)) {
    const raw = m[2].split(/\s|,/)[0]
    let abs: string
    try {
      abs = new URL(raw, base).toString()
    } catch {
      continue
    }
    if (seen.has(abs)) continue
    seen.add(abs)
    const text = (m[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? '').trim()
    const tail = html.slice(m.index! + m[0].length, m.index! + m[0].length + 160).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (/logo|brand|press|kit|asset|download|\.svg|\.eps|\.zip|\.ai\b|\.png/i.test(abs + ' ' + text + ' ' + tail)) out.push(`${m[1]} ${abs}${text ? ` [alt: ${text}]` : ''}${tail ? ` (${tail})` : ''}`)
  }
  for (const line of out.slice(0, 400)) console.log(line)
  console.log(`explore: ${out.length} candidate link(s) of ${seen.size}`)
}
