import type { Review, RubricVersion } from '@/payload-types'
import { RUBRIC_V15 } from '@/rubric/v15'

import { rel } from './format'

export type ScoreKey = keyof NonNullable<Review['scores']>

// How the sixteen categories group into the narrative sections of a review.
export const REVIEW_SECTIONS: { id: string; title: string; keys: ScoreKey[] }[] = [
  { id: 'room', title: 'The room', keys: ['roomLayout', 'bathroom', 'bedAndSleep', 'tech'] },
  { id: 'public', title: 'Public space and amenities', keys: ['amenities', 'atmosphere', 'maintenance', 'location'] },
  { id: 'service', title: 'Service', keys: ['checkIn', 'serviceBaseline', 'servicePeak', 'operations', 'housekeeping'] },
  { id: 'dining', title: 'Breakfast, dining and departure', keys: ['breakfastAndDining', 'density', 'departure'] },
]

export type Category = {
  key: ScoreKey
  label: string
  group: 'hard' | 'soft'
  max: number | null
}

// The category list for a review: labels and grouping from its rubric
// version, maxima for its property type. Falls back to v15 when the version
// is not populated.
export function categoriesFor(review: Review): Category[] {
  const version = rel<RubricVersion>(review.rubricVersion)
  const source = version?.categories?.length ? version.categories : RUBRIC_V15
  return source.map((c) => ({
    key: c.key as ScoreKey,
    label: c.label,
    group: c.group,
    max: (review.propertyType === 'resort' ? c.maxResort : c.maxCity) ?? null,
  }))
}

export function groupMax(categories: Category[], group: 'hard' | 'soft'): number {
  return categories.filter((c) => c.group === group).reduce((n, c) => n + (c.max ?? 0), 0)
}

export function labelFor(categories: Category[], key: ScoreKey): string {
  return categories.find((c) => c.key === key)?.label ?? key
}
