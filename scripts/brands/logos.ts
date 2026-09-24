// Brand logos from Wikimedia Commons, saved into public/images/brands so the
// site serves them itself. One search per brand, the best-looking candidate
// wins (an SVG whose title names the brand and says "logo"). Every pick is
// recorded in data/brand-logos.json with its Commons page, so a wrong pick can
// be pinned to a better file there and the script re-run:
//
//   npm run fetch:brand-logos              every brand without a logo
//   npm run fetch:brand-logos -- --all     re-fetch everything
//
// The images step (npm run import:webflow -- images) then points each brand
// at its copy.
import fs from 'fs'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'

type Pick = { file: string; page: string; url: string; license?: string; pin?: string | string[]; note?: string; at: string }
type Info = { title: string; mime?: string; url?: string; descriptionurl?: string; width?: number; height?: number; license?: string; source?: string }

const ALL = process.argv.includes('--all')
const OUT_DIR = path.resolve(process.cwd(), 'public/images/brands')
const RECORD = path.resolve(process.cwd(), 'data/brand-logos.json')
const IMAGES = path.resolve(process.cwd(), 'data/images.json')
const UA = 'LoyalistTravelBot/1.0 (https://www.loyalisttravel.com; brand logos for hotel program pages)'

// Where the plain "<name> logo" search finds the wrong thing, or nothing.
const QUERY: Record<string, string> = {
  'hyatt-brand': 'Hyatt Hotels logo',
  'caption-by-hyatt': 'Caption by Hyatt logo',
  'jdv-by-hyatt': 'JdV by Hyatt logo',
  'unbound-collection': 'Unbound Collection by Hyatt logo',
  'dreams-resorts': 'Dreams Resorts & Spas logo',
  'secrets-resorts': 'Secrets Resorts & Spas logo',
  'hilton-hotels-resorts': 'Hilton Hotels & Resorts logo',
  lxr: 'LXR Hotels & Resorts logo',
  'small-luxury-hotels': 'Small Luxury Hotels of the World logo',
  regent: 'Regent Hotels & Resorts logo',
  voco: 'voco hotels IHG logo',
  edition: 'Edition Hotels logo',
  'w-hotels': 'W Hotels logo',
  'luxury-collection': 'The Luxury Collection Marriott logo',
  'st-regis': 'St. Regis Hotels & Resorts logo',
  'even-hotels': 'EVEN Hotels logo',
  'delta-hotels': 'Delta Hotels by Marriott logo',
  renaissance: 'Renaissance Hotels logo',
  sheraton: 'Sheraton Hotels and Resorts logo',
  westin: 'Westin Hotels & Resorts logo',
  nomad: 'NoMad Hotels logo',
  'graduate-by-hilton': 'Graduate Hotels logo',
  'marriott-hotels': 'Marriott Hotels logo',
  'ritz-carlton': 'The Ritz-Carlton logo',
  'ritz-carlton-reserve': 'Ritz-Carlton Reserve logo',
  conrad: 'Conrad Hotels & Resorts logo',
  'hyatt-regency': 'Hyatt Regency logo',
  andaz: 'Andaz Hyatt logo',
  alila: 'Alila Hotels logo',
  miraval: 'Miraval Resorts logo',
  'thompson-hotels': 'Thompson Hotels logo',
  'six-senses': 'Six Senses Hotels Resorts Spas logo',
  kimpton: 'Kimpton Hotels & Restaurants logo',
  'design-hotels': 'Design Hotels logo',
  'gaylord-hotels': 'Gaylord Hotels logo',
  'moxy': 'Moxy Hotels logo',
  'aloft': 'Aloft Hotels logo',
  'ac-hotels': 'AC Hotels by Marriott logo',
  bulgari: 'Bulgari Hotels & Resorts logo',
  iberostar: 'Iberostar logo',
}

const norm = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.(svg|png|jpe?g)$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Commons first, then English Wikipedia, which holds the marks Commons will
// not: those too original for the text-logo rule, kept there under fair use.
const SOURCES = ['https://commons.wikimedia.org/w/api.php', 'https://en.wikipedia.org/w/api.php']

async function api(source: string, params: Record<string, string>): Promise<{ query?: { pages?: Record<string, { title: string; imageinfo?: Info[] }> } }> {
  const u = new URL(source)
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v)
  const res = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Commons ${res.status} for ${u.searchParams.get('gsrsearch') ?? u.searchParams.get('titles')}`)
  return (await res.json()) as never
}

function infoOf(pages: Record<string, { title: string; imageinfo?: Info[] }> | undefined): Info[] {
  return Object.values(pages ?? {}).map((p) => {
    const i = p.imageinfo?.[0] as (Info & { extmetadata?: Record<string, { value?: string }> }) | undefined
    return { title: p.title, mime: i?.mime, url: i?.url, descriptionurl: i?.descriptionurl, width: i?.width, height: i?.height, license: i?.extmetadata?.LicenseShortName?.value }
  })
}

async function search(source: string, q: string): Promise<Info[]> {
  const r = await api(source, { action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' })
  return infoOf(r.query?.pages).map((i) => ({ ...i, source }))
}

async function fileInfo(title: string): Promise<Info | undefined> {
  for (const source of SOURCES) {
    const i = infoOf((await api(source, { action: 'query', titles: title.startsWith('File:') ? title : `File:${title}`, prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' })).query?.pages)[0]
    if (i?.url) return { ...i, source }
  }
  return undefined
}

// Higher is better. Nothing is disqualified outright except files that do not
// name the brand; the ranking does the rest.
const FILLER = new Set(['logo', 'logos', 'hotel', 'hotels', 'resort', 'resorts', 'and', 'the', 'by', 'of', 'a', 'an', 'new', 'svg', 'png', 'collection', 'spa', 'spas', 'restaurants', 'brand', 'wordmark', 'vector', 'official', 'colour', 'color', 'rgb', 'en', 'tm', 'endorsed', 'international', 'worldwide', 'inc'])
const FAMILY = /\b(hilton|hyatt|marriott|ihg|intercontinental|hotel|hotels|resort|resorts|collection)\b/

// The words of the brand's own name that a file title has to carry. "Hotels",
// "by Hilton" and the like are not required, so "Canopy Hotels Logo" passes
// for Canopy by Hilton; "Hyatt Logo" fails for Hyatt Centric.
const OWN: Record<string, string[]> = {
  'hilton-hotels-resorts': ['hilton'],
  'hyatt-brand': ['hyatt'],
  iberostar: ['iberostar'],
  'small-luxury-hotels': ['small', 'luxury'],
  'luxury-collection': ['luxury', 'collection'],
  'unbound-collection': ['unbound'],
  'jdv-by-hyatt': ['jdv'],
  'ritz-carlton-reserve': ['ritz', 'carlton', 'reserve'],
}
// Brands named after an everyday word: the title must also say hotel, resort
// or the parent, or "Tempo-Logo.svg" is some other Tempo.
const GENERIC = new Set(['tempo', 'motto', 'edition', 'vignette', 'secrets', 'dreams', 'caption', 'signia', 'tribute', 'nomad', 'even', 'graduate', 'canopy', 'destination', 'autograph', 'curio', 'tapestry', 'delta', 'design', 'regent', 'moxy', 'aloft', 'thompson', 'alila', 'miraval'])
function ownWords(slug: string, brand: string): string[] {
  if (OWN[slug]) return OWN[slug]
  const bare = norm(brand).replace(/\b(by|of) (hilton|hyatt|marriott|the world)\b/, '')
  const words = bare.split(' ').filter((w) => w && !FILLER.has(w))
  return words.length ? words : norm(brand).split(' ')
}

// Higher is better; below zero is out. A title must name every word of the
// brand and no other real word: "Conrad Manila logo" and "Park Hyatt Buenos
// Aires" are a property's mark, not the brand's.
function score(i: Info, slug: string, brand: string): number {
  const t = norm(i.title.replace(/^File:/, ''))
  const words = t.split(' ').filter(Boolean)
  const own = ownWords(slug, brand)
  for (const w of own) if (!words.includes(w)) return -1
  const extra = words.filter((w) => !own.includes(w) && !FILLER.has(w) && !/^(hilton|hyatt|marriott|ihg)$/.test(w) && !/^\d+$/.test(w))
  if (extra.length) return -1
  // a brand that is a common word ("Tempo", "Motto", "Edition", "Secrets") has
  // to say it is a hotel somewhere in the title
  if (own.length === 1 && GENERIC.has(own[0]) && !FAMILY.test(t)) return -1
  let s = 0
  if (i.mime === 'image/svg+xml') s += 40
  else if (i.mime === 'image/png') s += 20
  else if (i.mime === 'image/jpeg' && /\blogo\b/.test(t)) s += 5
  else return -1
  if (/\blogo\b/.test(t)) s += 20
  if (FAMILY.test(t)) s += 8
  if (/wordmark|icon|symbol|monogram/.test(t)) s -= 5
  if (/\b(19\d\d|200\d|201[0-5])\b|\bold\b|former|previous|legacy/.test(t)) s -= 25
  if (i.width && i.height && i.width / i.height < 1.2) s -= 5 // squat marks sit badly in a landscape tile
  s -= Math.min(10, t.length / 8) // shorter titles are usually the canonical file
  return s
}

async function download(i: Info, slug: string): Promise<string> {
  const res = await fetch(i.url!, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`download ${res.status} for ${i.title}`)
  const data = Buffer.from(await res.arrayBuffer())
  const ext = i.mime === 'image/svg+xml' ? 'svg' : 'png'
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const old of fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${slug}.`))) fs.unlinkSync(path.join(OUT_DIR, old))
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.${ext}`), data)
  return `/images/brands/${slug}.${ext}`
}

function forget(slug: string, images: Record<string, string>, record: Record<string, Pick>) {
  const local = images[slug]
  if (local && fs.existsSync(path.join(process.cwd(), 'public', local))) fs.unlinkSync(path.join(process.cwd(), 'public', local))
  delete images[slug]
  if (record[slug]) record[slug] = record[slug].pin ? ({ pin: record[slug].pin, note: record[slug].note } as Pick) : (undefined as unknown as Pick)
  if (record[slug] === undefined) delete record[slug]
}

async function main() {
  const payload = await getPayload({ config })
  const brands = (await payload.find({ collection: 'brands', limit: 200, depth: 0, sort: 'name', select: { name: true, slug: true } })).docs
  const record: Record<string, Pick> = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : {}
  const images = JSON.parse(fs.readFileSync(IMAGES, 'utf8')) as { brands?: Record<string, string> }
  images.brands = images.brands ?? {}
  let got = 0
  let missed = 0
  for (const b of brands) {
    const prev = record[b.slug]
    const pinned = prev?.pin
    if (!ALL && !pinned && images.brands[b.slug] && fs.existsSync(path.join(process.cwd(), 'public', images.brands[b.slug]))) continue
    try {
      let choice: Info | undefined
      if (pinned) {
        for (const t of Array.isArray(pinned) ? pinned : [pinned]) {
          choice = await fileInfo(t)
          if (choice?.url) break
        }
        if (!choice?.url) console.log(`  ${b.slug}: pinned file not found (${[pinned].flat().join(', ')}); searching instead`)
      }
      if (!choice?.url) {
        const short = b.name.replace(/\s+(by|of)\s+(hyatt|hilton|marriott|the world)$/i, '').replace(/\s+hotels?( & resorts)?$/i, '')
        const base = QUERY[b.slug] ?? `${b.name} logo`
        const queries = [`${base} filetype:drawing`, `${short} logo filetype:drawing`, `${base} filetype:bitmap`, `${short} logo filetype:bitmap`, `intitle:"${short}" filetype:drawing`, `intitle:"${short}" filetype:bitmap`, `${short} hotel logo`]
        const seen = new Map<string, Info>()
        let ranked: { i: Info; s: number }[] = []
        for (const source of SOURCES) {
          for (const q of queries) {
            for (const i of await search(source, q)) if (!seen.has(i.title)) seen.set(i.title, i)
            ranked = [...seen.values()].map((i) => ({ i, s: score(i, b.slug, b.name) })).filter((x) => x.s >= 0).sort((a, c) => c.s - a.s)
            if (ranked.length && ranked[0].s >= 40) break
          }
          if (ranked.length && ranked[0].s >= 40) break
        }
        choice = ranked[0]?.i
        if (choice) console.log(`  ${b.slug}: ${ranked.slice(0, 4).map((x) => `${x.i.title.replace(/^File:/, '')} (${x.s.toFixed(0)})`).join(' | ')}`)
        else console.log(`  ${b.slug}: saw ${[...seen.keys()].slice(0, 8).map((t) => t.replace(/^File:/, '')).join(' | ') || 'nothing'}`)
      }
      if (!choice?.url) {
        missed++
        console.log(`${b.slug}: no logo found for "${b.name}"`)
        forget(b.slug, images.brands, record)
        continue
      }
      const local = await download(choice, b.slug)
      images.brands[b.slug] = local
      record[b.slug] = { file: choice.title, page: choice.descriptionurl ?? '', url: choice.url, license: choice.license, pin: prev?.pin, note: prev?.note ?? (choice.source?.includes('wikipedia') ? 'from English Wikipedia (fair use)' : undefined), at: new Date().toISOString().slice(0, 10) }
      got++
      console.log(`${b.slug}: ${choice.title.replace(/^File:/, '')} -> ${local}`)
    } catch (e) {
      missed++
      console.log(`${b.slug}: ${(e as Error).message}`)
      if (!pinned && !(e as Error).message.startsWith('pinned')) forget(b.slug, images.brands, record)
    }
    // save as it goes, so a run cut short keeps what it found
    fs.writeFileSync(RECORD, JSON.stringify(record, null, 2) + '\n')
    fs.writeFileSync(IMAGES, JSON.stringify(images, null, 2) + '\n')
  }
  console.log(`\nbrand logos: ${got} fetched, ${missed} without, ${Object.keys(images.brands).length} on file`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
