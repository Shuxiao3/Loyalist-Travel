// How current a reported or reader stay is. Computed when a page renders,
// never stored, since it decays with time. A stay is placed by its month
// when known, else the post date, else the year; a stay with no date at
// all is low.

export type Recency = 'high' | 'medium' | 'low'

export const RECENCY_WEIGHT: Record<Recency, number> = { high: 1, medium: 0.6, low: 0.3 }
export const RECENCY_LABEL: Record<Recency, string> = { high: 'High', medium: 'Medium', low: 'Low' }

const HIGH_MONTHS = 12
const MEDIUM_MONTHS = 30

function monthsAgo(ym: string, now: Date): number {
  const [y, m] = ym.split('-').map(Number)
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - (m || 1))
}

// From a YYYY-MM or YYYY-MM-DD string.
export function recencyOfMonth(ym: string | null | undefined, now = new Date()): Recency {
  if (!ym || !/^\d{4}-\d{2}/.test(ym)) return 'low'
  const age = monthsAgo(ym.slice(0, 7), now)
  if (age <= HIGH_MONTHS) return 'high'
  if (age <= MEDIUM_MONTHS) return 'medium'
  return 'low'
}

// From a year alone (reader stays): this year and last are high, the two
// before medium, older low.
export function recencyOfYear(year: number | null | undefined, now = new Date()): Recency {
  if (!year) return 'low'
  const age = now.getUTCFullYear() - year
  if (age <= 1) return 'high'
  if (age <= 3) return 'medium'
  return 'low'
}

// The confidence in a hotel's block as a whole: count and freshness together.
export function blockConfidence(recencies: Recency[]): Recency {
  const n = recencies.length
  const high = recencies.filter((r) => r === 'high').length
  const notLow = recencies.filter((r) => r !== 'low').length
  if (n >= 5 && high >= 3) return 'high'
  if (n >= 3 && notLow >= 1) return 'medium'
  return 'low'
}

export const CONFIDENCE_TIP = 'Confidence rises with more stays and with more recent stays. High needs five or more stays, three of them within the last year. Medium needs three or more, with at least one in the last two and a half years.'

export const CONFIDENCE_NOTE: Record<Recency, string> = {
  high: 'Five or more stays, at least three within the last year.',
  medium: 'Three or more stays, at least one within the last two and a half years.',
  low: 'Too few stays, or none recent enough, to lean on.',
}

// A rate where each stay counts by its recency weight. `n` stays the raw count.
export function weightedRate(items: { recency: Recency; yes: boolean }[]): { value: number | null; n: number } {
  const den = items.reduce((a, i) => a + RECENCY_WEIGHT[i.recency], 0)
  const num = items.filter((i) => i.yes).reduce((a, i) => a + RECENCY_WEIGHT[i.recency], 0)
  return { value: den > 0 ? Math.round((num / den) * 100) : null, n: items.length }
}
