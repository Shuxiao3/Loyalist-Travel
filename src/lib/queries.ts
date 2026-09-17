// Every public read goes through here. Public pages see published records
// only; drafts are for the admin.

import type { Where } from 'payload'

import type { Brand, Destination, Hotel, Program, Review } from '@/payload-types'

import { getPayloadClient } from './payload'
import { hotelReaderData, MIN_STAYS, type HotelReaderData } from './readerData'

export { getPayloadClient }

const published: Where = { _status: { equals: 'published' } }

export async function getReview(slug: string): Promise<Review | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reviews',
    where: { and: [{ slug: { equals: slug } }, published] },
    depth: 2,
    limit: 1,
  })
  return res.docs[0] ?? null
}

export async function getReviews(opts: { limit?: number; page?: number; excludeId?: number } = {}) {
  const payload = await getPayloadClient()
  const where: Where = opts.excludeId ? { and: [published, { id: { not_equals: opts.excludeId } }] } : published
  return payload.find({
    collection: 'reviews',
    where,
    sort: '-publishedDate',
    depth: 1,
    limit: opts.limit ?? 12,
    page: opts.page ?? 1,
  })
}

export async function getReviewsForHotel(hotelId: number) {
  const payload = await getPayloadClient()
  return payload.find({
    collection: 'reviews',
    where: { and: [{ hotel: { equals: hotelId } }, published] },
    sort: '-stayDate',
    depth: 1,
    limit: 20,
  })
}

export async function getHotel(slug: string): Promise<Hotel | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'hotels',
    where: { and: [{ slug: { equals: slug } }, published] },
    depth: 1,
    limit: 1,
  })
  return res.docs[0] ?? null
}

export type HotelFilters = {
  q?: string
  program?: string
  brand?: string
  country?: string
  scored?: string
  page?: number
}

export const HOTELS_PER_PAGE = 48

export async function findHotels(f: HotelFilters) {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  if (f.q) and.push({ or: [{ name: { contains: f.q } }, { fullName: { contains: f.q } }] })
  if (f.program) and.push({ 'program.slug': { equals: f.program } })
  if (f.brand) and.push({ 'brand.slug': { equals: f.brand } })
  if (f.country) and.push({ 'destination.country': { equals: f.country } })
  if (f.scored === 'yes') and.push({ reviewStatus: { equals: 'reviewed' } })
  return payload.find({
    collection: 'hotels',
    where: { and },
    sort: 'name',
    depth: 1,
    limit: HOTELS_PER_PAGE,
    page: f.page ?? 1,
  })
}

export async function getHotelFilterOptions() {
  const payload = await getPayloadClient()
  const [programs, brands, destinations] = await Promise.all([
    payload.find({ collection: 'programs', sort: 'name', limit: 20, depth: 0 }),
    payload.find({ collection: 'brands', sort: 'name', limit: 200, depth: 0 }),
    payload.find({ collection: 'destinations', where: published, limit: 2000, depth: 0, select: { country: true } }),
  ])
  const countries = [...new Set(destinations.docs.map((d) => d.country).filter((c): c is string => Boolean(c)))].sort()
  return { programs: programs.docs, brands: brands.docs, countries }
}

export async function getHotelsIn(where: Where, limit = 60) {
  const payload = await getPayloadClient()
  return payload.find({ collection: 'hotels', where: { and: [published, where] }, sort: 'name', depth: 1, limit })
}

export async function getBrand(slug: string): Promise<Brand | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'brands', where: { slug: { equals: slug } }, depth: 1, limit: 1 })
  return res.docs[0] ?? null
}

export async function getDestination(slug: string): Promise<Destination | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'destinations', where: { and: [{ slug: { equals: slug } }, published] }, depth: 1, limit: 1 })
  return res.docs[0] ?? null
}

export async function getProgram(slug: string): Promise<Program | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, depth: 1, limit: 1 })
  return res.docs[0] ?? null
}

export async function getPrograms() {
  const payload = await getPayloadClient()
  const programs = await payload.find({ collection: 'programs', sort: 'name', limit: 20, depth: 1 })
  return Promise.all(
    programs.docs.map(async (program) => {
      const [hotels, scored] = await Promise.all([
        payload.count({ collection: 'hotels', where: { and: [published, { program: { equals: program.id } }] } }),
        payload.count({ collection: 'reviews', where: { and: [published, { 'hotel.program': { equals: program.id } }] } }),
      ])
      return { program, hotels: hotels.totalDocs, scored: scored.totalDocs }
    }),
  )
}

// The hotel ticked "featured", or failing that the hotel with the most
// approved reader stays, provided it has enough for aggregates.
export async function getFeaturedHotel(): Promise<{ hotel: Hotel; data: HotelReaderData } | null> {
  const payload = await getPayloadClient()
  const featured = await payload.find({ collection: 'hotels', where: { and: [published, { featured: { equals: true } }] }, depth: 1, limit: 1 })
  if (featured.docs[0]) return { hotel: featured.docs[0], data: await hotelReaderData(featured.docs[0].id) }

  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: { hotel_id: number; n: string }[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const top = await db.drizzle.execute(sql`select hotel_id, count(*)::int as n from reader_stays where status = 'approved' group by hotel_id order by n desc limit 1`)
  const row = top.rows?.[0]
  if (!row || Number(row.n) < MIN_STAYS) return null
  const hotel = await payload.find({ collection: 'hotels', where: { and: [published, { id: { equals: row.hotel_id } }] }, depth: 1, limit: 1 })
  if (!hotel.docs[0]) return null
  return { hotel: hotel.docs[0], data: await hotelReaderData(hotel.docs[0].id) }
}

export async function getSiteCounts() {
  const payload = await getPayloadClient()
  const [hotels, reviews, programs] = await Promise.all([
    payload.count({ collection: 'hotels', where: published }),
    payload.count({ collection: 'reviews', where: published }),
    payload.count({ collection: 'programs' }),
  ])
  return { hotels: hotels.totalDocs, reviews: reviews.totalDocs, programs: programs.totalDocs }
}
