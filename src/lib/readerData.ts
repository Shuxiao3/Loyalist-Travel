// Aggregates over approved reader stays. Shown publicly only once a hotel
// has MIN_STAYS approved stays (decision log, content model 4).

import type { Where } from 'payload'

import type { ReaderStay, StatusLevel } from '@/payload-types'

import { getPayloadClient } from './payload'
import { blockConfidence, type Recency, recencyOfYear, weightedRate } from './recency'

export const MIN_STAYS = 5
export const MIN_STAYS_SITEWIDE = 20

export type ReaderAggregate = {
  stays: number
  confidence: Recency // count and freshness together
  recent: number // stays from this year or last
  certStays: number // stays where a suite upgrade certificate was applied
  upgradeRate: number | null // any upgrade, over all stays
  suiteRate: number | null // ended up in a suite, certificate or not, over all stays
  suiteNoCertRate: number | null // a suite without a certificate, over stays without one
  proactiveRate: number | null // offered without asking, over upgrades without a certificate
  latest: number | null // most recent stay year
}

// Rates count every stay, each weighted by how recent it is (this year and
// last count in full, older ones less).
export function aggregate(stays: Pick<ReaderStay, 'upgrade' | 'upgradeType' | 'upgradeHow' | 'suiteAward' | 'stayYear'>[], now = new Date()): ReaderAggregate {
  const rs = stays.map((s) => ({ s, recency: recencyOfYear(s.stayYear, now) }))
  const n = stays.length
  const suite = ({ s }: { s: (typeof stays)[number] }) => s.upgrade === 'yes' && s.upgradeType === 'suite'
  const noCert = rs.filter(({ s }) => s.suiteAward !== 'yes')
  const upgrades = noCert.filter(({ s }) => s.upgrade === 'yes')
  const latest = stays.reduce<number | null>((acc, s) => (acc == null || s.stayYear > acc ? s.stayYear : acc), null)
  const recencies = rs.map((x) => x.recency)
  return {
    stays: n,
    confidence: blockConfidence(recencies),
    recent: recencies.filter((r) => r === 'high').length,
    certStays: n - noCert.length,
    upgradeRate: weightedRate(rs.map((x) => ({ recency: x.recency, yes: x.s.upgrade === 'yes' }))).value,
    suiteRate: weightedRate(rs.map((x) => ({ recency: x.recency, yes: suite(x) }))).value,
    suiteNoCertRate: weightedRate(noCert.map((x) => ({ recency: x.recency, yes: suite(x) }))).value,
    proactiveRate: weightedRate(upgrades.map((x) => ({ recency: x.recency, yes: x.s.upgradeHow === 'proactive' }))).value,
    latest,
  }
}

async function approvedStays(where: Where) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reader-stays',
    where: { and: [{ status: { equals: 'approved' } }, where] },
    limit: 5000,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs
}

// Per hotel: the count always, and the picture once the threshold is met.
export type HotelReaderData = { count: number; all?: ReaderAggregate; byTier?: { tier: StatusLevel; data: ReaderAggregate }[] }

export async function hotelReaderData(hotelId: number): Promise<HotelReaderData> {
  const stays = await approvedStays({ hotel: { equals: hotelId } })
  if (stays.length < MIN_STAYS) return { count: stays.length }
  const tiers = new Map<number, { tier: StatusLevel; stays: typeof stays }>()
  for (const s of stays) {
    const tier = typeof s.statusHeld === 'object' ? s.statusHeld : null
    if (!tier) continue
    const entry = tiers.get(tier.id) ?? { tier, stays: [] }
    entry.stays.push(s)
    tiers.set(tier.id, entry)
  }
  const byTier = [...tiers.values()].sort((a, b) => (b.tier.rank ?? 0) - (a.tier.rank ?? 0)).map((t) => ({ tier: t.tier, data: aggregate(t.stays) }))
  return { count: stays.length, all: aggregate(stays), byTier }
}

// Site-wide headline for the homepage band: top-tier stays at city hotels.
export async function sitewideReaderData(): Promise<{ all: ReaderAggregate; topTier: ReaderAggregate; topTierCity: ReaderAggregate } | null> {
  const stays = await approvedStays({})
  if (stays.length < MIN_STAYS_SITEWIDE) return null
  const isTop = (s: ReaderStay) => typeof s.statusHeld === 'object' && Boolean(s.statusHeld.isTopTier)
  const isCity = (s: ReaderStay) => typeof s.hotel === 'object' && s.hotel.propertyType === 'city'
  const top = stays.filter(isTop)
  return { all: aggregate(stays), topTier: aggregate(top), topTierCity: aggregate(top.filter(isCity)) }
}

export async function readerStayCount(): Promise<number> {
  const payload = await getPayloadClient()
  const res = await payload.count({ collection: 'reader-stays', where: { status: { equals: 'approved' } }, overrideAccess: true })
  return res.totalDocs
}

// The most recent approved stays at a hotel, with the reader and tier populated.
export async function latestStays(hotelId: number, limit = 8): Promise<ReaderStay[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'reader-stays', where: { and: [{ hotel: { equals: hotelId } }, { status: { equals: 'approved' } }] }, sort: '-createdAt', limit, depth: 1, overrideAccess: true })
  return res.docs
}
