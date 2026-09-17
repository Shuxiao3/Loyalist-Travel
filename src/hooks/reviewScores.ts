import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

import { RUBRIC_KEYS } from '../rubric/v15'

type Category = {
  key: string
  group: 'hard' | 'soft'
  maxCity?: number | null
  maxResort?: number | null
}

// Hard, soft and overall totals are computed on save and never typed
// (decision log, content model 2). Each category score is validated against
// the maximum for that rubric version and property type when one is set.
export const computeReviewScores: CollectionBeforeChangeHook = async ({ data, req, collection }) => {
  const scores: Record<string, number | null | undefined> = data.scores ?? {}
  const propertyType: 'city' | 'resort' = data.propertyType === 'resort' ? 'resort' : 'city'

  let categories: Category[] = []
  const versionId = typeof data.rubricVersion === 'object' ? data.rubricVersion?.id : data.rubricVersion
  if (versionId) {
    const version = await req.payload.findByID({
      collection: 'rubric-versions',
      id: versionId,
      depth: 0,
      req,
    })
    categories = (version?.categories ?? []) as Category[]
  }

  const errors: { path: string; message: string }[] = []
  let hard = 0
  let soft = 0

  for (const key of RUBRIC_KEYS) {
    const value = scores[key]
    if (value == null) continue
    const category = categories.find((c) => c.key === key)
    const max = propertyType === 'resort' ? category?.maxResort : category?.maxCity
    if (max != null && value > max) {
      errors.push({
        path: `scores.${key}`,
        message: `${key} is ${value}; the maximum for a ${propertyType} hotel on this rubric is ${max}.`,
      })
    }
    const group = category?.group ?? inferGroup(key)
    if (group === 'hard') hard += value
    else soft += value
  }

  if (errors.length) {
    throw new ValidationError({ collection: collection.slug, errors })
  }

  return {
    ...data,
    totals: { hard, soft, overall: hard + soft },
  }
}

// Falls back to the v15 grouping when the rubric version has no entry for a key.
function inferGroup(key: string): 'hard' | 'soft' {
  const hardKeys = ['roomLayout', 'bathroom', 'bedAndSleep', 'tech', 'amenities', 'atmosphere', 'maintenance', 'location']
  return hardKeys.includes(key) ? 'hard' : 'soft'
}
