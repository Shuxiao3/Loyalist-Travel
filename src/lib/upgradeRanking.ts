// Hotels ranked by their upgrade chance, for the "highest upgrade chance"
// sorts. A rate is worked out from individual stays, each weighted by how
// recent it is, so the database cannot sort on it; every approved row of the
// pool is read once and the rate computed exactly as the hotel page does
// (aggregateSourced() for forum and blog reports, aggregate() for readers).
// A hotel ranks only once it has enough stays for its rate to mean something,
// the same bars the hotel page and the cards use, so one lucky stay does not
// put a hotel at 100% on top.

import type { ReaderStay, SourcedReport } from '@/payload-types'

import { getPayloadClient } from './payload'
import { aggregate, MIN_STAYS } from './readerData'
import { aggregateSourced } from './sourcedData'

export type UpgradePool = 'aggregated' | 'reader'
export type UpgradeRank = { id: number; rate: number; n: number }

// reported stays that said whether an upgrade came, as on the cards
export const MIN_RATED_REPORTS = 3

const idOf = (v: number | { id: number } | null | undefined): number | null => (v && typeof v === 'object' ? v.id : (v ?? null))

function group<T extends { hotel?: number | { id: number } | null }>(rows: T[]): Map<number, T[]> {
  const by = new Map<number, T[]>()
  for (const r of rows) {
    const id = idOf(r.hotel)
    if (id == null) continue
    const list = by.get(id)
    if (list) list.push(r)
    else by.set(id, [r])
  }
  return by
}

// Highest rate first; more stays behind the same rate rank higher.
export async function rankByUpgrade(pool: UpgradePool): Promise<UpgradeRank[]> {
  const payload = await getPayloadClient()
  const where = { status: { equals: 'approved' } }
  const now = new Date()
  const ranks: UpgradeRank[] = []
  if (pool === 'aggregated') {
    const res = await payload.find({ collection: 'sourced-reports', where, depth: 0, pagination: false, overrideAccess: true, select: { hotel: true, upgrade: true, upgradeType: true, sentiment: true, stayMonth: true, postDate: true } })
    for (const [id, rows] of group(res.docs as SourcedReport[])) {
      const { upgrade } = aggregateSourced(rows, now)
      if (upgrade.value != null && upgrade.n >= MIN_RATED_REPORTS) ranks.push({ id, rate: upgrade.value, n: upgrade.n })
    }
  } else {
    const res = await payload.find({ collection: 'reader-stays', where, depth: 0, pagination: false, overrideAccess: true, select: { hotel: true, upgrade: true, upgradeType: true, upgradeHow: true, suiteAward: true, stayYear: true } })
    for (const [id, rows] of group(res.docs as ReaderStay[])) {
      if (rows.length < MIN_STAYS) continue
      const { upgradeRate } = aggregate(rows, now)
      if (upgradeRate != null) ranks.push({ id, rate: upgradeRate, n: rows.length })
    }
  }
  return ranks.sort((a, b) => b.rate - a.rate || b.n - a.n)
}
