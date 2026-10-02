// Aggregates over approved reported stays (forum posts extracted by the
// pipeline). Shown on the hotel page in its own block, apart from reader
// stays, with a link to every source post. Every rate counts only the stays
// that answered the question, and says how many that was.

import type { SourcedReport, StatusLevel } from '@/payload-types'

import { getPayloadClient } from './payload'
import { blockConfidence, type Recency, recencyOfMonth, weightedRate } from './recency'

export type Rate = { value: number | null; n: number }
export type SourcedAggregate = {
  stays: number
  confidence: Recency // for the block as a whole: count and freshness together
  recent: number // stays with high recency
  upgrade: Rate // yes or award, over stays that said whether they were upgraded
  suite: Rate // award, or yes with a suite, over the same
  breakfast: Rate // anything but not-honoured, over eligible stays that said
  lounge: Rate // given, over given plus declined
  lateCheckout: Rate // honoured, over honoured plus declined
  sentiment: { positive: number; mixed: number; negative: number }
  latest: string | null // most recent stay month or post date, YYYY-MM
}
export type SourcedRow = {
  id: number
  source: SourcedReport['source']
  postUrl: string
  when: string | null // stay month, else post month
  tier: string | null
  summary: string
  upgrade: SourcedReport['upgrade']
  recency: Recency
}
export type HotelSourcedData = { count: number; data: SourcedAggregate | null; rows: SourcedRow[] }

const stayMonth = (r: Pick<SourcedReport, 'stayMonth' | 'postDate'>) => r.stayMonth || (r.postDate ? r.postDate.slice(0, 7) : null)

// Rates count only the stays that answered the question, each weighted by
// how recent it is, so a run of old refusals does not bury a fresh upgrade.
export function aggregateSourced(reports: Pick<SourcedReport, 'upgrade' | 'upgradeType' | 'breakfast' | 'loungeAccess' | 'lateCheckout' | 'sentiment' | 'stayMonth' | 'postDate'>[], now = new Date()): SourcedAggregate {
  const rs = reports.map((r) => ({ r, recency: recencyOfMonth(stayMonth(r), now) }))
  const said = rs.filter(({ r }) => r.upgrade !== 'unknown')
  const bEligible = rs.filter(({ r }) => r.breakfast !== 'unknown' && r.breakfast !== 'not-eligible')
  const lAsked = rs.filter(({ r }) => r.loungeAccess === 'given' || r.loungeAccess === 'declined')
  const cAsked = rs.filter(({ r }) => r.lateCheckout === 'honoured' || r.lateCheckout === 'declined')
  const months = reports.map(stayMonth).filter((m): m is string => Boolean(m)).sort()
  const recencies = rs.map((x) => x.recency)
  return {
    stays: reports.length,
    confidence: blockConfidence(recencies),
    recent: recencies.filter((x) => x === 'high').length,
    upgrade: weightedRate(said.map(({ r, recency }) => ({ recency, yes: r.upgrade === 'yes' || r.upgrade === 'award' }))),
    suite: weightedRate(said.map(({ r, recency }) => ({ recency, yes: r.upgrade === 'award' || (r.upgrade === 'yes' && r.upgradeType === 'suite') }))),
    breakfast: weightedRate(bEligible.map(({ r, recency }) => ({ recency, yes: r.breakfast !== 'not-honoured' }))),
    lounge: weightedRate(lAsked.map(({ r, recency }) => ({ recency, yes: r.loungeAccess === 'given' }))),
    lateCheckout: weightedRate(cAsked.map(({ r, recency }) => ({ recency, yes: r.lateCheckout === 'honoured' }))),
    sentiment: {
      positive: reports.filter((r) => r.sentiment === 'positive').length,
      mixed: reports.filter((r) => r.sentiment === 'mixed').length,
      negative: reports.filter((r) => r.sentiment === 'negative').length,
    },
    latest: months[months.length - 1] ?? null,
  }
}

export async function hotelSourcedData(hotelId: number): Promise<HotelSourcedData> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'sourced-reports',
    where: { and: [{ status: { equals: 'approved' } }, { hotel: { equals: hotelId } }] },
    sort: '-postDate',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  if (res.docs.length === 0) return { count: 0, data: null, rows: [] }
  const rows: SourcedRow[] = res.docs.map((r) => {
    const tier = typeof r.statusHeld === 'object' && r.statusHeld ? (r.statusHeld as StatusLevel) : null
    return {
      id: r.id,
      source: r.source,
      postUrl: r.postUrl,
      when: r.stayMonth || (r.postDate ? r.postDate.slice(0, 7) : null),
      tier: tier ? (tier.shortName ?? tier.name) : null,
      summary: r.summary,
      upgrade: r.upgrade,
      recency: recencyOfMonth(stayMonth(r)),
    }
  })
  return { count: res.docs.length, data: aggregateSourced(res.docs), rows }
}

export const SOURCE_LABEL: Record<string, string> = { reddit: 'Reddit', flyertalk: 'FlyerTalk', blog: 'Blog' }

export function monthLabel(ym: string | null): string {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
