// Small HTTP helpers for the data scripts: a polite GET with retries, and
// a fallback to the Internet Archive's latest saved copy for sites that
// refuse requests from data-centre addresses.

import zlib from 'zlib'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export type Got = { status: number; body: string }

// AbortSignal.timeout uses a timer that does not keep the process alive, so
// a request that never settles could drain the event loop and end a script
// silently. This timer is referenced: the process waits for it to fire.
function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(new Error(`timed out after ${ms}ms`)), ms)
  return run(ac.signal).finally(() => clearTimeout(t))
}

export async function get(url: string): Promise<Got> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { status, buf } = await withTimeout(75000, async (signal) => {
        const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml,text/xml,*/*', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal })
        return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) }
      })
      const body = url.endsWith('.gz') || buf.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8')
      if (status === 429 || status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      return { status, body }
    } catch (e) {
      if (attempt === 2) return { status: 0, body: String(e).slice(0, 200) }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  return { status: 0, body: '' }
}

// A page as the archive last saved it, without the archive's toolbar. The
// `looksRight` check rejects block pages the archive may have captured.
// `alternates` are address prefixes (an older URL scheme, say) to look under
// when the exact address has no capture; a trailing * means "anything after".
export async function getArchived(url: string, looksRight: (body: string) => boolean, alternates: string[] = []): Promise<Got> {
  const captures: { ts: string; original: string }[] = []
  for (const pattern of [url, ...alternates]) {
    const prefix = pattern.endsWith('*')
    const q = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(prefix ? pattern.slice(0, -1) : pattern)}${prefix ? '&matchType=prefix' : ''}&filter=statuscode:200&filter=mimetype:text/html&fl=timestamp,original&limit=-6&output=json`
    const cdx = await get(q)
    try {
      for (const r of (JSON.parse(cdx.body) as string[][]).slice(1).reverse()) captures.push({ ts: r[0], original: r[1] })
    } catch {
      /* no captures under this pattern */
    }
    if (captures.length >= 3) break
  }
  if (captures.length === 0) captures.push({ ts: '2026', original: url })
  let tried = 0
  for (const c of captures.slice(0, 6)) {
    tried++
    const res = await get(`https://web.archive.org/web/${c.ts}id_/${c.original}`)
    if (res.status === 200 && looksRight(res.body) && !/Access Denied|Reference #\d/.test(res.body.slice(0, 3000))) return res
  }
  return { status: 404, body: `no usable capture (${tried} tried)` }
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
