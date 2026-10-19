// One line of figures for a hotel card: how many stays are on record, from
// readers and from forum reports together, and the share that got an upgrade.
// The rate follows the hotel page exactly (aggregate() in readerData.ts and
// aggregateSourced() in sourcedData.ts): every stay weighted by how recent it
// is, reader stays by their year and reported stays by their month, with
// reports that never said whether an upgrade came left out of the rate but
// kept in the count. Only approved rows count, in both pools.

import type { Where } from 'payload'

import type { ReaderStay, SourcedReport } from '@/payload-types'

import { getPayloadClient } from './payload'
import { type Recency, recencyOfMonth, recencyOfYear, weightedRate } from './recency'

// `rated` is how many of the stays said whether an upgrade came, the count
// behind `upgradeRate`; a card prints the rate only once enough have.
export type HotelSnapshot = { stays: number; upgradeRate: number | null; rated: number; readerStays: number; sourcedStays: number }

export type SnapshotReaderRow = Pick<ReaderStay, 'upgrade' | 'stayYear'>
export type SnapshotSourcedRow = Pick<SourcedReport, 'upgrade' | 'stayMonth' | 'postDate'>

type RateItem = { recency: Recency; yes: boolean }

export const EMPTY_SNAPSHOT: HotelSnapshot = { stays: 0, upgradeRate: null, rated: 0, readerStays: 0, sourcedStays: 0 }

// A reader stay always answers the question: upgrade is yes or none.
export function readerUpgradeItem(s: SnapshotReaderRow, now = new Date()): RateItem {
  return { recency: recencyOfYear(s.stayYear, now), yes: s.upgrade === 'yes' }
}

// A reported stay counts only when the post said; a suite award is an
// upgrade. Placed by its stay month, else the month of the post.
export function sourcedUpgradeItem(r: SnapshotSourcedRow, now = new Date()): RateItem | null {
  if (r.upgrade === 'unknown') return null
  const month = r.stayMonth || (r.postDate ? r.postDate.slice(0, 7) : null)
  return { recency: recencyOfMonth(month, now), yes: r.upgrade === 'yes' || r.upgrade === 'award' }
}

// Pure: the snapshot for one hotel from its approved rows.
export function snapshotOf(reader: SnapshotReaderRow[], sourced: SnapshotSourcedRow[], now = new Date()): HotelSnapshot {
  const items: RateItem[] = [
    ...reader.map((s) => readerUpgradeItem(s, now)),
    ...sourced.map((r) => sourcedUpgradeItem(r, now)).filter((i): i is RateItem => i !== null),
  ]
  const rate = weightedRate(items)
  return {
    stays: reader.length + sourced.length,
    upgradeRate: rate.value,
    rated: rate.n,
    readerStays: reader.length,
    sourcedStays: sourced.length,
  }
}

const idOf = (v: number | { id: number } | null | undefined): number | null => (v && typeof v === 'object' ? v.id : (v ?? null))

// Snapshots for a page of hotels in two queries, one per pool. Every id asked
// for is in the result, with zeros and a null rate when nothing is reported.
// With `only`, the figures come from that pool alone, to match a list sorted
// by its upgrade chance.
export async function getHotelSnapshots(ids: number[], only?: 'aggregated' | 'reader'): Promise<Record<number, HotelSnapshot>> {
  const wanted = [...new Set(ids)]
  const out: Record<number, HotelSnapshot> = {}
  for (const id of wanted) out[id] = { ...EMPTY_SNAPSHOT }
  if (wanted.length === 0) return out

  const payload = await getPayloadClient()
  const where: Where = { and: [{ status: { equals: 'approved' } }, { hotel: { in: wanted } }] }
  const [reader, sourced] = await Promise.all([
    payload.find({ collection: 'reader-stays', where, depth: 0, pagination: false, select: { hotel: true, upgrade: true, stayYear: true }, overrideAccess: true }),
    payload.find({ collection: 'sourced-reports', where, depth: 0, pagination: false, select: { hotel: true, upgrade: true, stayMonth: true, postDate: true }, overrideAccess: true }),
  ])

  const readerBy = new Map<number, SnapshotReaderRow[]>()
  for (const s of reader.docs) {
    const id = idOf(s.hotel)
    if (id == null) continue
    readerBy.set(id, [...(readerBy.get(id) ?? []), s])
  }
  const sourcedBy = new Map<number, SnapshotSourcedRow[]>()
  for (const r of sourced.docs) {
    const id = idOf(r.hotel)
    if (id == null) continue
    sourcedBy.set(id, [...(sourcedBy.get(id) ?? []), r])
  }

  const now = new Date()
  for (const id of wanted) out[id] = snapshotOf(only === 'aggregated' ? [] : (readerBy.get(id) ?? []), only === 'reader' ? [] : (sourcedBy.get(id) ?? []), now)
  return out
}
