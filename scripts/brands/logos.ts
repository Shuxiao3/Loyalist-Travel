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

type Pick = { file: string; page: string; url: string; license?: string; pin?: string; note?: string; at: string }
type Info = { title: string; mime?: string; url?: string; descriptionurl?: string; width?: number; height?: number; license?: string }

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

// A word the file title must contain, where the first word of the name is
// too generic on its own.
const MUST: Record<string, string> = {
  'w-hotels': 'w hotels',
  'hyatt-brand': 'hyatt',
  'luxury-collection': 'luxury collection',
  'unbound-collection': 'unbound',
  'jdv-by-hyatt': 'jdv',
  'small-luxury-hotels': 'small luxury',
  'ac-hotels': 'ac hotel',
  'st-regis': 'regis',
  'le-meridien': 'ridien',
  'design-hotels': 'design hotels',
  'hotel-indigo': 'indigo',
  'even-hotels': 'even',
  'hilton-hotels-resorts': 'hilton',
  'graduate-by-hilton': 'graduate',
  'destination-by-hyatt': 'destination',
  'caption-by-hyatt': 'caption',
  'dreams-resorts': 'dreams',
  'secrets-resorts': 'secrets',
  'gaylord-hotels': 'gaylord',
  'delta-hotels': 'delta',
  'marriott-hotels': 'marriott',
}

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ')

async function api(params: Record<string, string>): Promise<{ query?: { pages?: Record<string, { title: string; imageinfo?: Info[] }> } }> {
  const u = new URL('https://commons.wikimedia.org/w/api.php')
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

async function search(q: string): Promise<Info[]> {
  const r = await api({ action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' })
  return infoOf(r.query?.pages)
}

async function fileInfo(title: string): Promise<Info | undefined> {
  const r = await api({ action: 'query', titles: title.startsWith('File:') ? title : `File:${title}`, prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' })
  return infoOf(r.query?.pages)[0]
}

// Higher is better. Nothing is disqualified outright except files that do not
// name the brand; the ranking does the rest.
function score(i: Info, must: string): number {
  const t = norm(i.title.replace(/^File:/, ''))
  if (!t.includes(must)) return -1
  let s = 0
  if (i.mime === 'image/svg+xml') s += 40
  else if (i.mime === 'image/png') s += 20
  else return -1
  if (/\blogo\b/.test(t)) s += 20
  if (/wordmark|icon|symbol|monogram/.test(t)) s -= 5
  if (/\b(19\d\d|200\d|201[0-5])\b|old|former|previous|legacy/.test(t)) s -= 25
  if (/\bnew\b|\b20(1[6-9]|2\d)\b/.test(t)) s += 5
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
        choice = await fileInfo(pinned)
        if (!choice?.url) throw new Error(`pinned file not found: ${pinned}`)
      } else {
        const must = MUST[b.slug] ?? norm(b.name).split(' ').find((w) => w.length > 2) ?? norm(b.name)
        const q = QUERY[b.slug] ?? `${b.name} logo`
        let found = await search(q)
        let ranked = found.map((i) => ({ i, s: score(i, must) })).filter((x) => x.s >= 0).sort((a, c) => c.s - a.s)
        if (!ranked.length) {
          found = await search(`${b.name} hotel logo svg`)
          ranked = found.map((i) => ({ i, s: score(i, must) })).filter((x) => x.s >= 0).sort((a, c) => c.s - a.s)
        }
        choice = ranked[0]?.i
        if (choice) console.log(`  ${b.slug}: ${ranked.slice(0, 3).map((x) => `${x.i.title.replace(/^File:/, '')} (${x.s.toFixed(0)})`).join(' | ')}`)
      }
      if (!choice?.url) {
        missed++
        console.log(`${b.slug}: no logo found for "${b.name}"`)
        continue
      }
      const local = await download(choice, b.slug)
      images.brands[b.slug] = local
      record[b.slug] = { file: choice.title, page: choice.descriptionurl ?? '', url: choice.url, license: choice.license, pin: prev?.pin, note: prev?.note, at: new Date().toISOString().slice(0, 10) }
      got++
      console.log(`${b.slug}: ${choice.title.replace(/^File:/, '')} -> ${local}`)
    } catch (e) {
      missed++
      console.log(`${b.slug}: ${(e as Error).message}`)
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
