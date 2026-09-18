// Lounge queries and the aggregates over approved reader stays that rated
// them. Shown once a lounge has MIN_STAYS rated stays.

import type { Where } from 'payload'

import { LOUNGE_FACTORS, type LoungeFactor } from '@/lib/stayOptions'
import type { Hotel, Lounge, ReaderStay } from '@/payload-types'

import { getPayloadClient } from './payload'
import { MIN_STAYS } from './readerData'

const published: Where = { _status: { equals: 'published' } }

export type LoungeAggregate = {
  stays: number // stays that used the lounge and gave an overall score
  accessRate: number | null // given over given plus declined
  score: number | null // mean overall score out of 5, one decimal
  factors: Record<LoungeFactor, number | null> // mean of each 1-5 score
  worthItRate: number | null // yes over yes plus no
  comments: number // stays that left a comment
}

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
}

export function aggregateLounge(stays: Pick<ReaderStay, 'lounge'>[]): LoungeAggregate {
  const answers = stays.map((s) => s.lounge).filter((l): l is NonNullable<ReaderStay['lounge']> => Boolean(l))
  const asked = answers.filter((l) => l.access === 'given' || l.access === 'declined')
  const given = asked.filter((l) => l.access === 'given').length
  const rated = answers.filter((l) => typeof l.overall === 'number')
  const worth = answers.filter((l) => l.worthIt === 'yes' || l.worthIt === 'no')
  const yes = worth.filter((l) => l.worthIt === 'yes').length
  const factors = Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, mean(answers.map((l) => l[f.name]).filter((n): n is number => typeof n === 'number'))])) as Record<LoungeFactor, number | null>
  return {
    stays: rated.length,
    accessRate: asked.length ? Math.round((given / asked.length) * 100) : null,
    score: factors.overall,
    factors,
    worthItRate: worth.length ? Math.round((yes / worth.length) * 100) : null,
    comments: answers.filter((l) => l.comment?.trim()).length,
  }
}

export async function loungeReaderData(loungeId: number): Promise<{ count: number; data?: LoungeAggregate }> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reader-stays',
    where: { and: [{ status: { equals: 'approved' } }, { 'lounge.lounge': { equals: loungeId } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const data = aggregateLounge(res.docs)
  if (data.stays < MIN_STAYS) return { count: data.stays }
  return { count: data.stays, data }
}

// Individual approved stays for the lounge page, newest first. Only the
// lounge answers, tier and year are shown; nothing identifies the reader.
export async function getLoungeStays(loungeId: number, limit = 100): Promise<ReaderStay[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reader-stays',
    where: { and: [{ status: { equals: 'approved' } }, { 'lounge.lounge': { equals: loungeId } }] },
    sort: '-createdAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs
}

export async function getLounge(slug: string): Promise<Lounge | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'lounges', where: { and: [{ slug: { equals: slug } }, published] }, depth: 2, limit: 1 })
  return res.docs[0] ?? null
}

export async function getLoungesForHotel(hotelId: number): Promise<Lounge[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'lounges', where: { and: [{ hotel: { equals: hotelId } }, published] }, depth: 1, limit: 10 })
  return res.docs
}

export type LoungeRow = { lounge: Lounge; hotel: Hotel | null; data: LoungeAggregate | null }

// Every published lounge with its numbers, rated first, best first.
export async function getLoungeDirectory(filters: { program?: string; country?: string } = {}): Promise<LoungeRow[]> {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  if (filters.program) and.push({ 'hotel.program.slug': { equals: filters.program } })
  if (filters.country) and.push({ 'hotel.destination.country': { equals: filters.country } })
  const lounges = await payload.find({ collection: 'lounges', where: { and }, depth: 2, limit: 500, sort: 'name' })
  const rows = await Promise.all(
    lounges.docs.map(async (lounge) => {
      const d = await loungeReaderData(lounge.id)
      return { lounge, hotel: typeof lounge.hotel === 'object' ? lounge.hotel : null, data: d.data ?? null }
    }),
  )
  return rows.sort((a, b) => (b.data?.score ?? -1) - (a.data?.score ?? -1) || a.lounge.name.localeCompare(b.lounge.name))
}

// The access line for a directory row: tier short names, then club rooms and paid access.
export function accessLine(lounge: Lounge): string {
  const tiers = (lounge.access?.tiers ?? []).map((t) => (typeof t === 'object' ? (t.shortName ?? t.name) : null)).filter(Boolean) as string[]
  const parts = [...tiers]
  if (lounge.access?.clubRooms) parts.push('club rooms')
  if (lounge.access?.paid) parts.push('paid access')
  return parts.join(', ') || 'Access not recorded'
}

export function servicesLine(lounge: Lounge): string {
  const names: Record<string, string> = { breakfast: 'Breakfast', 'afternoon-tea': 'afternoon tea', evening: 'evening cocktails', 'all-day': 'all-day snacks' }
  const s = (lounge.services ?? []).map((x) => names[x.service] ?? x.service)
  return s.length ? s[0].charAt(0).toUpperCase() + s[0].slice(1) + (s.length > 1 ? ', ' + s.slice(1).join(', ') : '') : ''
}
