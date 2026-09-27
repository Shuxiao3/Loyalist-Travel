import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

import { RUBRIC_SECTIONS, RUBRIC_V16 } from '../rubric/v16'

// Category totals and the 100-point score are computed on save and never
// typed. Each sub-score is checked against its maximum (5 on v16, or the
// rubric version's own maximum when it names one).
export const computeReviewScores: CollectionBeforeChangeHook = async ({ data, req, collection }) => {
  const scores: Record<string, number | null | undefined> = data.scores ?? {}
  const propertyType: 'city' | 'resort' = data.propertyType === 'resort' ? 'resort' : 'city'

  let versionMax = new Map<string, number>()
  const versionId = typeof data.rubricVersion === 'object' ? data.rubricVersion?.id : data.rubricVersion
  if (versionId) {
    const version = await req.payload.findByID({ collection: 'rubric-versions', id: versionId, depth: 0, req })
    versionMax = new Map(
      (version?.categories ?? []).map((c) => [c.key, (propertyType === 'resort' ? c.maxResort : c.maxCity) ?? NaN]).filter(([, m]) => Number.isFinite(m as number)) as [string, number][],
    )
  }

  const errors: { path: string; message: string }[] = []
  const totals: Record<string, number> = Object.fromEntries(RUBRIC_SECTIONS.map((s) => [s.id, 0]))
  let overall = 0
  for (const c of RUBRIC_V16) {
    const value = scores[c.key]
    if (value == null) continue
    const max = versionMax.get(c.key) ?? c.max
    if (value > max || value < 0) errors.push({ path: `scores.${c.key}`, message: `${c.label} is ${value}; it is scored out of ${max}.` })
    totals[c.section] += value
    overall += value
  }
  if (errors.length) throw new ValidationError({ collection: collection.slug, errors })

  return { ...data, totals: { ...totals, overall } }
}
