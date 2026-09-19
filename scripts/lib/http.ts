// Small HTTP helpers for the data scripts: a polite GET with retries, and
// a fallback to the Internet Archive's latest saved copy for sites that
// refuse requests from data-centre addresses.

import zlib from 'zlib'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export type Got = { status: number; body: string }

export async function get(url: string): Promise<Got> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml,text/xml,*/*', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(60000) })
      const buf = Buffer.from(await res.arrayBuffer())
      const body = url.endsWith('.gz') || buf.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8')
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      return { status: res.status, body }
    } catch (e) {
      if (attempt === 2) return { status: 0, body: String(e).slice(0, 200) }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  return { status: 0, body: '' }
}

// A page as the archive last saved it, without the archive's toolbar. The
// `looksRight` check rejects block pages the archive may have captured.
export async function getArchived(url: string, looksRight: (body: string) => boolean): Promise<Got> {
  const cdx = await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&filter=statuscode:200&fl=timestamp&limit=-5&output=json`)
  let stamps: string[] = []
  try {
    stamps = (JSON.parse(cdx.body) as string[][]).slice(1).map((r) => r[0]).reverse()
  } catch {
    stamps = []
  }
  if (stamps.length === 0) stamps = ['2026']
  for (const ts of stamps) {
    const res = await get(`https://web.archive.org/web/${ts}id_/${url}`)
    if (res.status === 200 && looksRight(res.body) && !/Access Denied|Reference #\d/.test(res.body.slice(0, 3000))) return res
  }
  return { status: 404, body: `no usable capture (${stamps.length} tried)` }
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
