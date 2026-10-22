// What the homepage needs beyond the shared queries. Review lists are read at depth 1, which
// leaves each hotel's destination and program as ids, so their names come in two small reads.

import type { Hotel, Program, Review } from '@/payload-types'

import { getPayloadClient } from './payload'
import { PROGRAM_LINKS } from './site'

const idOf = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number' ? (v as { id: number }).id : null)

// The city and program of each review's hotel, by review id.
export async function reviewPlaces(reviews: Review[]): Promise<Map<number, { city: string | null; program: string | null }>> {
  const hotels = reviews.map((r) => (typeof r.hotel === 'object' ? r.hotel : null))
  const destIds = [...new Set(hotels.map((h) => idOf(h?.destination)).filter((n): n is number => n != null))]
  const payload = await getPayloadClient()
  const [dests, programs] = await Promise.all([
    destIds.length ? payload.find({ collection: 'destinations', where: { id: { in: destIds } }, depth: 0, limit: destIds.length, select: { name: true } }) : null,
    payload.find({ collection: 'programs', depth: 0, limit: 20, select: { name: true } }),
  ])
  const destName = new Map((dests?.docs ?? []).map((d) => [d.id, d.name]))
  const progName = new Map(programs.docs.map((p) => [p.id, p.name]))
  return new Map(
    reviews.map((r, i) => {
      const h: Hotel | null = hotels[i]
      const d = idOf(h?.destination)
      const p = idOf(h?.program)
      return [r.id, { city: d != null ? (destName.get(d) ?? null) : null, program: p != null ? (progName.get(p) ?? null) : null }]
    }),
  )
}

// The four programs in the site's order (PROGRAM_LINKS), with their logos populated.
export async function programsInOrder(): Promise<Program[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'programs', depth: 1, limit: 20 })
  const rank = (slug: string) => {
    const i = PROGRAM_LINKS.findIndex((p) => p.slug === slug)
    return i < 0 ? PROGRAM_LINKS.length : i
  }
  return [...res.docs].sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name))
}

// The names of the programs whose hotels have a club lounge on record, in the site's order.
export async function loungePrograms(): Promise<string[]> {
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: { slug: string; name: string }[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const res = await db.drizzle.execute(sql`select distinct p.slug, p.name from lounges l
    join hotels h on h.id = l.hotel_id
    join programs p on p.id = h.program_id
    where l._status = 'published' and h._status = 'published'`)
  const rank = (slug: string) => {
    const i = PROGRAM_LINKS.findIndex((p) => p.slug === slug)
    return i < 0 ? PROGRAM_LINKS.length : i
  }
  return res.rows.sort((a, b) => rank(a.slug) - rank(b.slug)).map((r) => r.name)
}
