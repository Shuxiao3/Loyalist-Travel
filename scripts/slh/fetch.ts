// Fills in the Small Luxury Hotels of the World entries of
// data/hilton/hotels.json from slh.com. hilton.com lists the SLH hotels it
// sells (brand code LX), but it refuses requests from data centres, and most
// of those pages have no archived copy, so the Hilton fetch knows little more
// than their names: the city it guesses from the hotel code is the nearest
// airport's. Each SLH hotel's own page on slh.com states its address. Runs on
// the GitHub runner (this sandbox cannot reach slh.com). Facts only.
//
//   npm run fetch:slh              every LX entry not read from its Hilton page
//   npm run fetch:slh -- --limit 20   a sample, for checking the parser

import fs from 'fs'
import path from 'path'

import type { HiltonHotel } from '../hilton/fetch'
import { get, mapLimit } from '../lib/http'

const FILE = path.resolve(process.cwd(), 'data/hilton/hotels.json')
const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity
const SUFFIX = ', an SLH Hotel'

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', ndash: '\u2013', mdash: '\u2014', szlig: '\u00df', oslash: '\u00f8', Oslash: '\u00d8', aelig: '\u00e6', AElig: '\u00c6', eth: '\u00f0', thorn: '\u00fe' }
// "&ocirc;" -> "o" with a circumflex: a letter and its accent, for the named accented letters
const MARKS: Record<string, string> = { acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', tilde: '\u0303', cedil: '\u0327', ring: '\u030a', caron: '\u030c' }
const named = (m: string, n: string) => {
  const accented = n.match(/^([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring|caron)$/)
  return accented ? (accented[1] + MARKS[accented[2]]).normalize('NFC') : (ENTITIES[n] ?? m)
}
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, named)
    .replace(/\s+/g, ' ')
    .trim()

// "Hôtel & Spa d'Auteuil" -> "hotel-and-spa-d-auteuil"
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const words = (s: string) => new Set(s.split('-').filter((w) => w.length > 1 && !['the', 'hotel', 'and', 'an', 'slh', 'by', 'de', 'la', 'le'].includes(w)))

export type SlhAddress = { name: string; street: string | null; city: string | null; postalCode: string | null; region: string | null; country: string | null }

// The "Hotel Address" block: the name, one or more street lines, then the
// city, the postcode, the state (often blank) and the country, one <p> each.
// Where a country has no postcodes the block is one line short, and the
// line before the country is a postcode only if it has a digit. A town
// repeated as a street line ("Windham", "Windham") and a lone "." are dropped.
export function parseAddress(html: string): SlhAddress | null {
  const m = html.match(/Hotel Address\s*<\/h2>\s*<\/div>((?:\s*<p>[^<]*<\/p>){3,10})/)
  if (!m) return null
  const p = [...m[1].matchAll(/<p>([^<]*)<\/p>/g)].map((x) => decode(x[1]))
  const [name] = p
  const country = p[p.length - 1] || null
  const mid = p.slice(1, -1)
  let street: string[] = []
  let city: string | null = null
  let postalCode: string | null = null
  let region: string | null = null
  if (mid.length >= 4) {
    region = mid[mid.length - 1] || null
    postalCode = mid[mid.length - 2] || null
    city = mid[mid.length - 3] || null
    street = mid.slice(0, -3)
  } else if (mid.length >= 2) {
    const last = mid[mid.length - 1]
    if (/\d/.test(last)) postalCode = last
    else region = last || null
    city = mid[mid.length - 2] || null
    street = mid.slice(0, -2)
  } else city = mid[0] || null
  const streetLine = street.filter((l) => l && !/^[\s.,-]*$/.test(l) && l !== city).join(', ') || null
  return { name, street: streetLine, city, postalCode, region, country }
}

async function slhHotelPages(): Promise<string[]> {
  const index = await get('https://slh.com/sitemapindex.xml')
  if (index.status !== 200) throw new Error(`slh sitemap index: HTTP ${index.status}`)
  const maps = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /sitemap-main/.test(u))
  const pages = new Set<string>()
  for (const map of maps) {
    const res = await get(map)
    for (const m of res.body.matchAll(/<loc>(https:\/\/slh\.com\/hotels\/[a-z0-9-]+)\/?<\/loc>/g)) pages.add(m[1])
  }
  return [...pages]
}

async function main() {
  const all = JSON.parse(fs.readFileSync(FILE, 'utf8')) as HiltonHotel[]
  const todo = all.filter((h) => h.brandCode === 'LX' && h.source !== 'page').slice(0, LIMIT)
  const pages = await slhHotelPages()
  const bySlug = new Map(pages.map((u) => [u.replace(/^.*\/hotels\//, ''), u]))
  console.log(`${pages.length} hotel pages on slh.com; ${todo.length} SLH entries to fill`)

  // the Hilton address slug ("adllmlx-le-mas-barossa" -> "le-mas-barossa"),
  // else the name's, else the one SLH page sharing most of its words
  const match = (h: HiltonHotel): string | null => {
    const fromUrl = h.url.match(/\/hotels\/[a-z0-9]+-([a-z0-9-]+)\/?$/)?.[1] ?? ''
    const fromName = slug((h.name ?? '').replace(SUFFIX, ''))
    for (const s of [fromUrl, fromName]) if (bySlug.has(s)) return bySlug.get(s)!
    const want = words(fromUrl || fromName)
    let best: { url: string; score: number } | null = null
    let tie = false
    for (const [s, url] of bySlug) {
      const have = words(s)
      const shared = [...want].filter((w) => have.has(w)).length
      const score = shared / Math.max(want.size, have.size, 1)
      if (!best || score > best.score) {
        best = { url, score }
        tie = false
      } else if (score === best.score) tie = true
    }
    return best && best.score >= 0.6 && !tie ? best.url : null
  }

  let filled = 0
  const unmatched: string[] = []
  const unread: string[] = []
  await mapLimit(todo, 4, async (h) => {
    const url = match(h)
    if (!url) {
      unmatched.push(`${h.name} (${h.url})`)
      return
    }
    const res = await get(url)
    const a = res.status === 200 ? parseAddress(res.body) : null
    if (!a || !a.city || !a.country) {
      unread.push(`${url}: HTTP ${res.status}${res.status === 200 ? ', no address block' : ''}`)
      return
    }
    h.name = a.name.endsWith(SUFFIX) ? a.name : `${a.name}${SUFFIX}`
    h.streetAddress = a.street
    h.city = a.city
    h.region = a.region
    h.postalCode = a.postalCode
    h.country = a.country
    h.source = 'slh'
    h.slhUrl = url
    filled++
    if (filled % 50 === 0) console.log(`${filled} filled`)
  })
  fs.writeFileSync(FILE, JSON.stringify(all, null, 1) + '\n')
  console.log(`slh: ${filled} filled from slh.com, ${unmatched.length} with no SLH page found, ${unread.length} pages without an address`)
  if (unmatched.length) console.log('no SLH page found:\n  ' + unmatched.join('\n  '))
  if (unread.length) console.log('pages without an address:\n  ' + unread.join('\n  '))
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('slh', 'fetch.ts'))) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
