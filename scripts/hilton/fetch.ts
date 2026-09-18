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
  source: 'page' | 'slug' // page: read from the hotel's own page; slug: derived from the address and city code
}

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity
// stop reading archived pages after this many minutes; the rest get slug
// records this run and are retried next run
const minutesArg = args.indexOf('--minutes')
const MINUTES = minutesArg >= 0 ? Number(args[minutesArg + 1]) : 100
const STARTED = Date.now()

// Hilton city codes (first three letters of a hotel code) to place, built
// from the public OurAirports data plus metropolitan codes.
const CITY_CODES = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/hilton/city-codes.json'), 'utf8')) as Record<string, { city: string; region: string; country: string }>

const SMALL = new Set(['of', 'by', 'the', 'and', 'at', 'on', 'in', 'de', 'la', 'del', 'du', 'des', 'a', 'an', 'to'])
const UPPER = new Set(['dc', 'nyc', 'jfk', 'lax', 'sfo', 'uk', 'usa', 'ii', 'iii', 'teca', 'cbd'])
const BRAND_PREFIX: Record<string, [RegExp, string]> = {
  DT: [/^doubletree(-by-hilton)?(-hotel)?(-suites)?-?/, 'DoubleTree by Hilton '],
  ES: [/^embassy-suites(-by-hilton)?(-hotel)?-?/, 'Embassy Suites by Hilton '],
  PY: [/^canopy(-by-hilton)?-?/, 'Canopy by Hilton '],
  SA: [/^signia(-by-hilton)?-?/, 'Signia by Hilton '],
  GU: [/^graduate(-by-hilton)?(-hotel)?-?/, 'Graduate by Hilton '],
  PO: [/^tempo(-by-hilton)?-?/, 'Tempo by Hilton '],
  UA: [/^motto(-by-hilton)?-?/, 'Motto by Hilton '],
  WA: [/^waldorf-astoria-?/, 'Waldorf Astoria '],
  CH: [/^conrad-?/, 'Conrad '],
  ND: [/^nomad-?/, 'NoMad '],
  HI: [/^$/, ''],
}
const BRAND_SUFFIX: Record<string, string> = { QQ: ', Curio Collection by Hilton', UP: ', Tapestry Collection by Hilton', OL: ', LXR Hotels & Resorts' }

// "abidtdt-doubletree-abilene-downtown-convention-center" -> a readable name
export function nameFromSlug(slug: string, brandCode: string): string {
  let rest = slug
  let prefix = ''
  const rule = BRAND_PREFIX[brandCode]
  if (rule && rule[0].test(rest)) {
    rest = rest.replace(rule[0], '')
    prefix = rule[1]
  }
  rest = rest.replace(/-?(curio-collection|tapestry-collection|lxr-hotels(-and)?-resorts|lxr)(-by-hilton)?$/, '')
  const words = rest.split('-').filter(Boolean).map((w, i) => (UPPER.has(w) ? w.toUpperCase() : SMALL.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
  return (prefix + words.join(' ')).trim() + (BRAND_SUFFIX[brandCode] ?? '')
}

function fromSlug(url: string): HiltonHotel {
  const m = url.match(HOTEL_URL)!
  const ctyhocn = m[1].toUpperCase()
  const brandCode = ctyhocn.slice(-2)
  const place = CITY_CODES[ctyhocn.slice(0, 3)]
  return {
    ctyhocn,
    brandCode,
    brandName: null,
    url,
    name: nameFromSlug(m[2], brandCode),
    streetAddress: null,
    city: place?.city ?? null,
    region: place?.region ?? null,
    postalCode: null,
    country: place?.country ?? null,
    phone: null,
    rooms: null,
    source: 'slug',
  }
}

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
      if (attempt === 2) return { status: 0, body: String(e).slice(0, 200) }
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
  const loc = children.find((c) => /sitemap-en-location-dt-001\.xml/.test(c))
  if (loc) {
    const sample = await get(loc)
    console.log(`location sitemap sample (${loc}):\n  ` + locs(sample.body).slice(0, 8).join('\n  '))
  }
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
  const rooms = first(/"(?:totalRooms|numberOfRooms|roomCount|totalNumberOfRooms)"\s*:\s*"?(\d{1,4})/)
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
    source: 'page',
  }
}

// Hotel pages refuse requests from data-centre addresses, so each page is
// read from the Internet Archive's most recent saved copy instead. The
// `id_` flag returns the page as it was served, without the archive's own
// toolbar. A page never archived comes back 404.
async function getArchived(url: string): Promise<{ status: number; body: string }> {
  // the archive's index: the last few captures that were a real 200
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
    if (res.status === 200 && /application\/ld\+json/.test(res.body) && !/Access Denied|Reference #\d/.test(res.body.slice(0, 3000))) return res
  }
  return { status: 404, body: `no usable capture (${stamps.length} tried)` }
}

async function main() {
  const urls = await discover()
  console.log(`\n${urls.length} hotel pages found`)
  if (urls.length === 0) {
    console.log('Nothing to fetch; the sitemap layout may have changed.')
    process.exit(1)
  }
  const existing: Record<string, HiltonHotel> = fs.existsSync(OUT) ? Object.fromEntries((JSON.parse(fs.readFileSync(OUT, 'utf8')) as HiltonHotel[]).map((h) => [h.url, h])) : {}
  const pending = urls.filter((u) => existing[u]?.source !== 'page')
  const todo = pending.slice(0, LIMIT)
  console.log(`${Object.values(existing).filter((h) => h.source === 'page').length} already read from their pages; ${pending.length} to do; ${todo.length} this run`)

  // a direct request first; if Hilton refuses it, read the archive copies
  let useArchive = false
  if (todo.length) {
    const probe = await get(todo[0])
    if (probe.status !== 200 || !/application\/ld\+json/.test(probe.body)) {
      console.log(`direct request refused (HTTP ${probe.status}); reading archived copies instead`)
      useArchive = true
    }
  }
  const results: HiltonHotel[] = []
  let i = 0
  let failures = 0
  let shown = 0
  let fromPage = 0
  const worker = async () => {
    while (i < todo.length) {
      const url = todo[i++]
      const outOfTime = (Date.now() - STARTED) / 60000 > MINUTES
      const { status, body } = outOfTime ? { status: 0, body: 'out of time' } : useArchive ? await getArchived(url) : await get(url)
      const ok = status === 200 && /application\/ld\+json/.test(body)
      if (!ok) {
        failures++
        results.push(existing[url] ?? fromSlug(url))
        if (failures <= 8) console.log(`${url}: HTTP ${status} ${body.slice(0, 120).replace(/\s+/g, ' ')}`)
        continue
      }
      const rec = parse(url, body)
      if (!rec.name || !rec.city || !rec.country) {
        // a page without the facts we need: keep the slug record instead
        const fb = fromSlug(url)
        results.push({ ...fb, name: rec.name ?? fb.name, city: rec.city ?? fb.city, country: rec.country ?? fb.country, region: rec.region ?? fb.region, streetAddress: rec.streetAddress, phone: rec.phone, rooms: rec.rooms, brandName: rec.brandName })
      } else {
        results.push(rec)
        fromPage++
      }
      if (shown < 3) {
        shown++
        console.log(JSON.stringify(rec))
      }
      if (results.length % 100 === 0) console.log(`${results.length} / ${todo.length} (${fromPage} from pages) after ${Math.round((Date.now() - STARTED) / 60000)} min`)
    }
  }
  await Promise.all(Array.from({ length: useArchive ? 4 : CONCURRENCY }, worker))
  // everything never attempted this run still gets a slug record so it can be imported now
  for (const url of pending.slice(todo.length)) if (!existing[url]) results.push(fromSlug(url))

  // keep records from earlier runs for pages not fetched this time (a --limit run)
  const merged = new Map<string, HiltonHotel>(Object.entries(existing))
  for (const r of results) merged.set(r.url, r)
  const all = [...merged.values()].sort((a, b) => a.url.localeCompare(b.url))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1) + '\n')

  const byBrand: Record<string, number> = {}
  for (const r of all) byBrand[r.brandCode ?? '??'] = (byBrand[r.brandCode ?? '??'] ?? 0) + 1
  console.log(`\nthis run: ${fromPage} read from pages, ${failures} not readable; file now holds ${all.length} hotels, ${all.filter((r) => r.source === 'page').length} from pages, ${all.filter((r) => r.source === 'slug').length} from slugs`)
  console.log('by brand code:', Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
  console.log(`missing city ${all.filter((r) => !r.city).length}, missing country ${all.filter((r) => !r.country).length}, with rooms ${all.filter((r) => r.rooms).length}`)
  process.exit(0)
}

if (process.argv[1]?.endsWith("fetch.ts")) main().catch((e) => {
  console.error(e)
  process.exit(1)
})
