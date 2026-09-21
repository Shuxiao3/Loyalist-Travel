import type { Review, RubricVersion } from '@/payload-types'
import { RUBRIC_SECTIONS, RUBRIC_V16, type SectionId } from '@/rubric/v16'

import { rel } from './format'

export type ScoreKey = keyof NonNullable<Review['scores']>

export type Category = {
  key: ScoreKey
  label: string
  section: SectionId
  max: number
}

// The six categories, each with the sub-scores that make it up. These are
// also the narrative sections of a review.
export const REVIEW_SECTIONS: { id: SectionId; title: string; max: number; keys: ScoreKey[] }[] = RUBRIC_SECTIONS.map((s) => ({
  id: s.id,
  title: s.label,
  max: s.max,
  keys: RUBRIC_V16.filter((c) => c.section === s.id).map((c) => c.key as ScoreKey),
}))

// The sub-score list for a review: v16, with labels and maxima overridden by
// the review's rubric version where it names them.
export function categoriesFor(review: Review): Category[] {
  const version = rel<RubricVersion>(review.rubricVersion)
  const own = new Map((version?.categories ?? []).map((c) => [c.key, c]))
  return RUBRIC_V16.map((c) => {
    const v = own.get(c.key)
    const max = v ? ((review.propertyType === 'resort' ? v.maxResort : v.maxCity) ?? c.max) : c.max
    return { key: c.key as ScoreKey, label: v?.label ?? c.label, section: c.section, max }
  })
}

// A category's points so far and its maximum, from the sub-scores present.
export function sectionTotal(review: Review, categories: Category[], keys: ScoreKey[]): { got: number; max: number } {
  let got = 0
  let max = 0
  for (const k of keys) {
    const c = categories.find((x) => x.key === k)
    if (!c) continue
    max += c.max
    got += review.scores?.[k] ?? 0
  }
  return { got, max }
}

// Score bands from the scoring workbook, on the percentage of the maximum.
export const SCORE_BANDS: { min: number; label: string }[] = [
  { min: 95, label: 'World Class' },
  { min: 90, label: 'Exceptional' },
  { min: 85, label: 'Excellent' },
  { min: 80, label: 'Great' },
  { min: 70, label: 'Very Good' },
  { min: 60, label: 'Good' },
  { min: 50, label: 'Fair' },
  { min: 0, label: 'Needs Work' },
]

export function bandFor(value: number | null | undefined, max = 100): string | null {
  if (value == null || max <= 0) return null
  const pct = (value / max) * 100
  return SCORE_BANDS.find((b) => pct >= b.min)?.label ?? null
}

export function labelFor(categories: Category[], key: ScoreKey): string {
  return categories.find((c) => c.key === key)?.label ?? key
}
