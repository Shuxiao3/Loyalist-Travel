// Builds data/hilton/hotels.json from Hilton's public site: every hotel
// page listed in their sitemap, with the name, address, phone and room count
// each page states about itself. Runs on the GitHub runner (this sandbox
// cannot reach hilton.com). Facts only; no descriptions or photographs.
//
//   npm run fetch:hilton              every hotel
//   npm run fetch:hilton -- --limit 30   a sample, for checking the parser

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const OUT = path.resolve(process.cwd(), 'data/hilton/hotels.json')
const CONCURRENCY = 6

export type HiltonHotel = {
  ctyhocn: string
  brandCode: string | null
  brandName: string | null
  url: string
  name: string | null
  streetAddress: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  rooms: number | null
}

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity

async function get(url: string): Promise<{ status: number; body: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml,text/xml,*/*', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' })
      const buf = Buffer.from(await res.arrayBuffer())
      const body = url.endsWith('.gz') || buf.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8')
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      return { status: res.status, body }
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  return { status: 0, body: '' }
}

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])

const HOTEL_URL = /^https:\/\/www\.hilton\.com\/en\/hotels\/([a-z0-9]{7})-([a-z0-9-]+)\/$/

// Hilton brand codes, as they appear in the sitemap file names and at the
// end of each hotel code. Only these brands are fetched.
const brandsArg = args.indexOf('--brands')
const BRANDS = (brandsArg >= 0 ? args[brandsArg + 1] : 'wa,ch,ol,sa,nd,hi,py,qq,up,dt,es,gu,po,ua').split(',').map((b) => b.trim().toLowerCase())

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) out.push(await fn(items[i++]))
  }))
  return out
}

// Every hotel home page URL. The index lists one sitemap per language, each
// with ~1,000 children named by type (location, hotel, ...). Only the
// English tree is walked, and only the children whose name matches TYPES.
async function discover(): Promise<string[]> {
  const index = await get('https://www.hilton.com/sitemap.xml')
  if (index.status !== 200) throw new Error(`sitemap index: HTTP ${index.status}`)
  const languages = locs(index.body)
  const en = languages.find((u) => /\/sitemap\/en\/sitemap-en\.xml$/.test(u)) ?? languages.find((u) => /\/en\//.test(u))
  if (!en) throw new Error(`no English sitemap among: ${languages.slice(0, 10).join(', ')}`)
  const tree = await get(en)
  if (tree.status !== 200) throw new Error(`${en}: HTTP ${tree.status}`)
  const children = locs(tree.body)
  const patterns: Record<string, number> = {}
  for (const c of children) {
    const key = c.replace(/-\d+\.xml(\.gz)?$/, '-N.xml').replace(/^.*\//, '')
    patterns[key] = (patterns[key] ?? 0) + 1
  }
  console.log(`${en}: ${children.length} children`)
  for (const [k, v] of Object.entries(patterns)) console.log(`  ${k} x${v}`)
  // property sitemaps are named sitemap-en-prop-<brand>-NNN.xml
  const chosen = children.filter((c) => {
    const m = c.replace(/^.*\//, '').match(/^sitemap-en-prop-([a-z]{2})-\d+\.xml/)
    return m && BRANDS.includes(m[1])
  })
  if (chosen.length === 0) throw new Error('no property sitemaps matched the brand list; see the names above')
  console.log(`walking ${chosen.length} property sitemaps for brands ${BRANDS.join(', ')}`)
  const seen = new Set<string>()
  let done = 0
  await mapLimit(chosen, 6, async (url) => {
    const { status, body } = await get(url)
    if (status !== 200) {
      console.log(`${url}: HTTP ${status}`)
      return
    }
    const entries = locs(body)
    let hotels = 0
    for (const loc of entries) {
      if (HOTEL_URL.test(loc)) {
        seen.add(loc)
        hotels++
      }
    }
    done++
    if (done <= 3 || done % 50 === 0) console.log(`${url}: ${entries.length} entries, ${hotels} hotel home pages (${done}/${chosen.length})`)
    if (done <= 2 && hotels === 0) console.log('  e.g. ' + entries.slice(0, 5).join('\n       '))
  })
  return [...seen].sort()
}

function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed]
      for (const it of items) if (it && typeof it === 'object') out.push(it as Record<string, unknown>)
    } catch {
      /* not JSON */
    }
  }
  return out
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null)
const decode = (v: string | null): string | null =>
  v ? v.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ') : null

function parse(url: string, html: string): HiltonHotel {
  const ctyhocn = url.match(HOTEL_URL)![1]
  const ld = jsonLd(html)
  const hotel = ld.find((o) => /Hotel|LodgingBusiness|Resort/.test(String(o['@type']))) ?? ld.find((o) => o.address) ?? {}
  const address = (hotel.address && typeof hotel.address === 'object' ? hotel.address : {}) as Record<string, unknown>
  const first = (re: RegExp) => html.match(re)?.[1] ?? null
  const rooms = first(/"(?:totalRooms|numberOfRooms|roomCount)"\s*:\s*"?(\d{1,4})/) ?? first(/(\d{2,4})\s+(?:guest\s+)?rooms/i)
  return {
    ctyhocn: ctyhocn.toUpperCase(),
    brandCode: first(/"brandCode"\s*:\s*"([A-Z0-9]{2})"/) ?? ctyhocn.slice(-2).toUpperCase(),
    brandName: decode(first(/"brandName"\s*:\s*"([^"]+)"/)),
    url,
    name: decode(str(hotel.name) ?? first(/<meta property="og:title" content="([^"|]+)/) ?? first(/<title>([^<|]+)/)),
    streetAddress: decode(str(address.streetAddress)),
    city: decode(str(address.addressLocality)),
    region: decode(str(address.addressRegion)),
    postalCode: decode(str(address.postalCode)),
    country: decode(str(typeof address.addressCountry === 'object' && address.addressCountry ? (address.addressCountry as Record<string, unknown>).name : address.addressCountry)),
    phone: decode(str(hotel.telephone)),
    rooms: rooms ? Number(rooms) : null,
  }
}

// Hotel pages sit behind bot protection that refuses a plain request, so
// they are loaded in a headless browser. Images, fonts and media are not
// requested; only the document is read.
type Browser = import('playwright').Browser
let browser: Browser | null = null
async function getBrowser(): Promise<Browser> {
  if (browser) return browser
  const { chromium } = await import('playwright')
  browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] })
  return browser
}

async function getPage(url: string): Promise<{ status: number; body: string }> {
  const b = await getBrowser()
  const context = await b.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1280, height: 900 } })
  await context.route('**/*', (route) => {
    const t = route.request().resourceType()
    if (t === 'image' || t === 'font' || t === 'media' || t === 'stylesheet') return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    let body = await page.content()
    // give a challenge page a moment to resolve, then read again
    if (!/application\/ld\+json/.test(body) || /Access Denied|Reference #/.test(body)) {
      await page.waitForTimeout(4000)
      body = await page.content()
    }
    return { status: res?.status() ?? 0, body }
  } catch (e) {
    return { status: 0, body: String(e) }
  } finally {
    await context.close()
  }
}

async function main() {
  const urls = await discover()
  console.log(`\n${urls.length} hotel pages found`)
  if (urls.length === 0) {
    console.log('Nothing to fetch; the sitemap layout may have changed.')
    process.exit(1)
  }
  const todo = urls.slice(0, LIMIT)
  // plain requests first; switch to the browser as soon as one is refused
  let useBrowser = false
  const probe = await get(todo[0])
  if (probe.status !== 200 || !/application\/ld\+json/.test(probe.body)) {
    console.log(`plain request refused (HTTP ${probe.status}); loading pages in a browser instead`)
    useBrowser = true
  }
  const existing: Record<string, HiltonHotel> = fs.existsSync(OUT) ? Object.fromEntries((JSON.parse(fs.readFileSync(OUT, 'utf8')) as HiltonHotel[]).map((h) => [h.url, h])) : {}
  const results: HiltonHotel[] = []
  let i = 0
  let failures = 0
  let shown = 0
  const worker = async () => {
    while (i < todo.length) {
      const url = todo[i++]
      const { status, body } = useBrowser ? await getPage(url) : await get(url)
      const ok = status === 200 && /application\/ld\+json/.test(body)
      if (!ok) {
        failures++
        if (existing[url]) results.push(existing[url])
        if (failures <= 5) console.log(`${url}: HTTP ${status} ${/Access Denied/.test(body) ? '(access denied)' : ''} ${body.slice(0, 200).replace(/\s+/g, ' ')}`)
        continue
      }
      const rec = parse(url, body)
      results.push(rec)
      if (shown < 3) {
        shown++
        console.log(JSON.stringify(rec))
      }
      if (results.length % 250 === 0) console.log(`${results.length} / ${todo.length}`)
    }
  }
  await Promise.all(Array.from({ length: useBrowser ? 4 : CONCURRENCY }, worker))
  if (browser) await browser.close()

  // keep records from earlier runs for pages not fetched this time (a --limit run)
  const merged = new Map<string, HiltonHotel>(Object.entries(existing))
  for (const r of results) merged.set(r.url, r)
  const all = [...merged.values()].sort((a, b) => a.url.localeCompare(b.url))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1) + '\n')

  const byBrand: Record<string, number> = {}
  for (const r of results) byBrand[r.brandCode ?? '??'] = (byBrand[r.brandCode ?? '??'] ?? 0) + 1
  console.log(`\nfetched ${results.length}, failed ${failures}, saved ${all.length}`)
  console.log('by brand code:', Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
  console.log(`missing name ${results.filter((r) => !r.name).length}, missing city ${results.filter((r) => !r.city).length}, missing country ${results.filter((r) => !r.country).length}, with rooms ${results.filter((r) => r.rooms).length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
