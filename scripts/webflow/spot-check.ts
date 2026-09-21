// Compares a random sample of imported records against the Webflow export,
// field by field, and prints any mismatch. Run after import:
//   npm run import:check -- 20
import fs from 'fs'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'

type Item = { id: string; isDraft: boolean; fieldData: Record<string, unknown> }
const read = (n: string): Item[] => JSON.parse(fs.readFileSync(path.resolve('data/webflow', `${n}.json`), 'utf8'))
const schemas = JSON.parse(fs.readFileSync(path.resolve('data/webflow/schemas.json'), 'utf8'))
const label = (c: string, f: string, id: unknown) => schemas[c].fields.find((x: { slug: string }) => x.slug === f)?.options?.[String(id)] ?? null

function sample<T>(arr: T[], n: number, seed = 7): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

async function main() {
  const n = Number(process.argv[2] || 20)
  const payload = await getPayload({ config })
  let problems = 0
  const check = (where: string, field: string, expected: unknown, actual: unknown) => {
    const e = expected ?? null
    const a = actual ?? null
    if (JSON.stringify(e) !== JSON.stringify(a)) {
      problems++
      console.log(`  MISMATCH ${where} ${field}: webflow=${JSON.stringify(e)} payload=${JSON.stringify(a)}`)
    }
  }

  const hotels = sample(read('hotels'), n)
  console.log(`Hotels (${hotels.length})`)
  for (const h of hotels) {
    const f = h.fieldData
    const res = await payload.find({ collection: 'hotels', where: { webflowId: { equals: h.id } }, depth: 1, limit: 1, draft: true, overrideAccess: true })
    const d = res.docs[0]
    if (!d) { problems++; console.log(`  MISSING hotel ${f.slug}`); continue }
    const w = `hotel ${f.slug}`
    check(w, 'name', f.name, d.name)
    check(w, 'slug', f.slug, d.slug)
    // Publishing on the site is allowed to run ahead of Webflow; the reverse is not.
    if (!h.isDraft) check(w, 'status', 'published', d._status)
    check(w, 'brand', f.brand, (d.brand as { webflowId?: string })?.webflowId)
    check(w, 'program', f['loyalty-program'], (d.program as { webflowId?: string })?.webflowId)
    check(w, 'destination', f.destination, (d.destination as { webflowId?: string })?.webflowId)
    check(w, 'segment', label('hotels', 'property-segment', f['property-segment'])?.toLowerCase().replace(' ', '-'), d.segment)
    check(w, 'checkInTime', f['check-in-time'] || null, d.checkInTime)
    check(w, 'bookingLink', f['booking-link'] || null, d.bookingLink)
    check(w, 'streetAddress', f['street-address'] || null, d.streetAddress)
    check(w, 'heroImage', (f['hero-image'] as { url?: string } | null)?.url ?? null, d.externalImageUrl)
    check(w, 'amenities', ((f.amenities as string[] | null) ?? []).length, ((d.amenities as unknown[]) ?? []).length)
    check(w, 'numberOfRooms', f['number-of-rooms'] ?? null, d.numberOfRooms)
  }

  const dests = sample(read('destinations'), Math.ceil(n / 4), 3)
  console.log(`Destinations (${dests.length})`)
  for (const x of dests) {
    const f = x.fieldData
    const res = await payload.find({ collection: 'destinations', where: { webflowId: { equals: x.id } }, depth: 1, limit: 1, draft: true, overrideAccess: true })
    const d = res.docs[0]
    if (!d) { problems++; console.log(`  MISSING destination ${f.slug}`); continue }
    const w = `destination ${f.slug}`
    check(w, 'name', f.name, d.name)
    check(w, 'country', f.country || null, d.country)
    check(w, 'locationLabel', f['location-label'] || null, d.locationLabel)
    check(w, 'region', f.region, (d.region as { webflowId?: string })?.webflowId)
    if (!x.isDraft) check(w, 'status', 'published', d._status)
  }

  console.log(`Reviews (all)`)
  for (const x of read('reviews')) {
    const f = x.fieldData
    const res = await payload.find({ collection: 'reviews', where: { webflowId: { equals: x.id } }, depth: 1, limit: 1, draft: true, overrideAccess: true })
    const d = res.docs[0]
    if (!d) { problems++; console.log(`  MISSING review ${f.slug}`); continue }
    const w = `review ${f.slug}`
    check(w, 'hotel', f.hotel, (d.hotel as { webflowId?: string })?.webflowId)
    // scores were read across to v16 on import; compared by eye, not here
    check(w, 'statusHeld', f['elite-status-during-stay'], (d.statusHeld as { webflowId?: string })?.webflowId)
    check(w, 'roomReceived', f['room-received'] || null, d.roomReceived)
    check(w, 'stayDate', String(f['stay-date']).slice(0, 10), String(d.stayDate).slice(0, 10))
    check(w, 'propertyType', label('reviews', 'property-type', f['property-type']) === 'Resort' ? 'resort' : 'city', d.propertyType)
    check(w, 'hasFinalVerdict', Boolean(f['final-verdict']), Boolean(d.finalVerdict))
    check(w, 'hasBathroomNarrative', Boolean(f['bathroom-review']), Boolean(d.narrative?.bathroom))
  }

  console.log(problems ? `\n${problems} problem(s)` : '\nAll checks passed')
  process.exit(problems ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
