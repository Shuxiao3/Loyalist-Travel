// Reads each hotel's page on its chain's own site and records whether the
// page lists a club or executive lounge. One program at a time; results go
// to data/lounges/<program>.json and are applied to the database by the
// `lounge-flags` import step. Runs on the GitHub runner (this sandbox
// cannot reach the chains' sites).
//
//   npm run fetch:lounges -- --program world-of-hyatt            every hotel not yet checked
//   npm run fetch:lounges -- --program marriott-bonvoy --limit 40 --dump   a sample, printing the matches
//
// Resumable: hotels already answered are skipped; unreadable ones are
// tried again next run.

import fs from 'fs'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { get, getArchived, mapLimit } from '../lib/http'

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const PROGRAM = arg('--program')
const LIMIT = arg('--limit') ? Number(arg('--limit')) : Infinity
const MINUTES = arg('--minutes') ? Number(arg('--minutes')) : 100
const DUMP = args.includes('--dump')
const STARTED = Date.now()
if (!PROGRAM) {
  console.log('Give a program: --program world-of-hyatt | marriott-bonvoy | ihg-one-rewards')
  process.exit(1)
}
const OUT = path.resolve(process.cwd(), `data/lounges/${PROGRAM}.json`)

// What a lounge is called on each chain's pages. A hit only counts when it
// is not inside talk about elite benefits in general (those phrases appear
// on every page of the chain, lounge or not).
const WORDS: Record<string, RegExp> = {
  'world-of-hyatt': /Regency Club|Grand Club|Club Lounge|Executive Lounge|(?<!Kids )Club Access|"clubLounge"/gi, // "Kids Club access" is not a lounge
  'marriott-bonvoy': /Executive Lounge|Club Lounge|Concierge Lounge|M Club|Club Level|Ritz-Carlton Club|Executive Club|St\. Regis Club|"executiveLounge"|"mClub"/gi,
  'ihg-one-rewards': /Club InterContinental|Club Lounge|Executive Lounge|Club Floor|Executive Club|"clubLounge"/gi,
}
const NOT_THIS_HOTEL = /globalist|explorist|discoverist|platinum|titanium|ambassador|diamond|elite|status|member benefit|bonvoy benefit|tier|earn |points/i
// which domains count as the chain's own page
const DOMAINS: Record<string, RegExp> = {
  'world-of-hyatt': /hyatt\.com/,
  'marriott-bonvoy': /marriott\.com|ritzcarlton\.com|editionhotels\.com|designhotels\.com/,
  'ihg-one-rewards': /ihg\.com|sixsenses\.com/,
}

type Result = { url: string; lounge: boolean; hits: string[]; at: string }

function detect(html: string, words: RegExp): { lounge: boolean; hits: string[] } {
  // strip tags so context reads as text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, (s) => (/"amenit|"feature|"clubLounge|"executiveLounge|"mClub/i.test(s) ? s : ' '))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
  const hits: string[] = []
  for (const m of text.matchAll(words)) {
    const ctx = text.slice(Math.max(0, m.index! - 70), m.index! + m[0].length + 70)
    // the benefit-talk check looks only at the words right next to the match
    const near = text.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 40)
    if (NOT_THIS_HOTEL.test(near)) continue
    hits.push(ctx.trim())
    if (hits.length >= 4) break
  }
  return { lounge: hits.length > 0, hits }
}

async function main() {
  const words = WORDS[PROGRAM!]
  const domain = DOMAINS[PROGRAM!]
  if (!words || !domain) throw new Error(`No reader for ${PROGRAM}`)
  const payload = await getPayload({ config })
  const program = (await payload.find({ collection: 'programs', where: { slug: { equals: PROGRAM } }, limit: 1, depth: 0 })).docs[0]
  if (!program) throw new Error(`Unknown program ${PROGRAM}`)
  const hotels = (await payload.find({ collection: 'hotels', where: { and: [{ _status: { equals: 'published' } }, { program: { equals: program.id } }] }, limit: 10000, depth: 0, select: { slug: true, name: true, bookingLink: true } })).docs
  const existing: Record<string, Result> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const candidates = hotels.filter((h) => h.bookingLink && domain.test(h.bookingLink))
  const pending = candidates.filter((h) => !existing[h.slug])
  const todo = pending.slice(0, LIMIT)
  console.log(`${program.name}: ${hotels.length} hotels, ${candidates.length} with a page on the chain's site, ${Object.keys(existing).length} already answered, ${pending.length} to do, ${todo.length} this run`)

  // direct first; if the chain refuses, read archived copies
  let useArchive = false
  if (todo.length) {
    const probe = await get(todo[0].bookingLink!)
    if (probe.status !== 200 || probe.body.length < 20000) {
      console.log(`direct request refused (HTTP ${probe.status}, ${probe.body.length} bytes); reading archived copies instead`)
      useArchive = true
    }
  }
  const looksRight = (body: string) => body.length > 20000 && !/Access Denied|Reference #\d|captcha/i.test(body.slice(0, 3000))

  let done = 0
  let read = 0
  let failed = 0
  await mapLimit(todo, useArchive ? 4 : 5, async (h) => {
    const url = h.bookingLink!
    const outOfTime = (Date.now() - STARTED) / 60000 > MINUTES
    const res = outOfTime ? { status: 0, body: 'out of time' } : useArchive ? await getArchived(url, looksRight) : await get(url)
    done++
    if (res.status !== 200 || !looksRight(res.body)) {
      failed++
      if (failed <= 8) console.log(`${h.slug}: HTTP ${res.status} ${res.body.slice(0, 100).replace(/\s+/g, ' ')}`)
      return
    }
    const d = detect(res.body, words)
    existing[h.slug] = { url, lounge: d.lounge, hits: d.hits.slice(0, 2), at: new Date().toISOString().slice(0, 10) }
    read++
    if (DUMP) console.log(`\n${h.name} -> ${d.lounge ? 'LOUNGE' : 'no'}${d.hits.map((x) => `\n    …${x}…`).join('')}`)
    if (done % 100 === 0) console.log(`${done} / ${todo.length} (${read} read) after ${Math.round((Date.now() - STARTED) / 60000)} min`)
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 1) + '\n')
  const all = Object.values(existing)
  console.log(`\nthis run: ${read} read, ${failed} not readable`)
  console.log(`lounges: ${all.filter((r) => r.lounge).length} with, ${all.filter((r) => !r.lounge).length} without, ${candidates.length - all.length} not checked`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
