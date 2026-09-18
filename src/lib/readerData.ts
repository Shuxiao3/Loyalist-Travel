// Aggregates over approved reader stays. Shown publicly only once a hotel
// has MIN_STAYS approved stays (decision log, content model 4).

import type { Where } from 'payload'

import type { ReaderStay, StatusLevel } from '@/payload-types'

import { getPayloadClient } from './payload'

export const MIN_STAYS = 5
export const MIN_STAYS_SITEWIDE = 20

export type ReaderAggregate = {
  stays: number
  awardStays: number // stays on a suite award, reported separately and left out of the upgrade rates
  upgradeRate: number | null // any upgrade, over stays not on an award
  suiteRate: number | null // upgraded to a suite, over stays not on an award
  proactiveRate: number | null // offered without asking, over upgrades
  breakfastRate: number | null // full, buffet, or uncapped a la carte, over stays where eligible
  lateCheckoutRate: number | null // honoured, over stays where it was requested
  latest: number | null // most recent stay year
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

export function aggregate(stays: Pick<ReaderStay, 'upgrade' | 'upgradeType' | 'upgradeHow' | 'breakfast' | 'alaCarteCap' | 'lateCheckout' | 'stayYear'>[]): ReaderAggregate {
  const n = stays.length
  const organic = stays.filter((s) => s.upgrade !== 'award')
  const awardStays = n - organic.length
  const upgrades = organic.filter((s) => s.upgrade === 'yes')
  const suites = upgrades.filter((s) => s.upgradeType === 'suite').length
  const proactive = upgrades.filter((s) => s.upgradeHow === 'proactive').length
  const breakfastEligible = stays.filter((s) => s.breakfast !== 'not-eligible')
  const breakfastFull = breakfastEligible.filter((s) => (s.breakfast === 'full' || s.breakfast === 'buffet' || s.breakfast === 'a-la-carte') && s.alaCarteCap !== 'capped').length
  const lateWanted = stays.filter((s) => s.lateCheckout !== 'not-requested')
  const lateGranted = lateWanted.filter((s) => s.lateCheckout === 'honoured').length
  const latest = stays.reduce<number | null>((acc, s) => (acc == null || s.stayYear > acc ? s.stayYear : acc), null)
  return {
    stays: n,
    awardStays,
    upgradeRate: pct(upgrades.length, organic.length),
    suiteRate: pct(suites, organic.length),
    proactiveRate: pct(proactive, upgrades.length),
    breakfastRate: pct(breakfastFull, breakfastEligible.length),
    lateCheckoutRate: pct(lateGranted, lateWanted.length),
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
