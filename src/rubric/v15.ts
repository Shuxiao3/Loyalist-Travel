// The Loyalist Travel rubric, version 15. Locked on Sep 16 2026; later
// changes become v16 (decision log, content model 1). Sixteen categories,
// eight hard and eight soft, 100 points at a city hotel.
//
// Maxima are from the scoring workbook (Luxury Criteria sheet): identical for
// city and resort except Amenities (city 7, resort 10) and Location (city 7,
// resort 4). Both property types total 55 hard and 45 soft.

export type RubricGroup = 'hard' | 'soft'

export type RubricCategory = {
  key: string
  label: string
  group: RubricGroup
  maxCity: number | null
  maxResort: number | null
}

export const RUBRIC_V15: RubricCategory[] = [
  { key: 'roomLayout', label: 'Room layout', group: 'hard', maxCity: 10, maxResort: 10 },
  { key: 'bathroom', label: 'Bathroom', group: 'hard', maxCity: 8, maxResort: 8 },
  { key: 'bedAndSleep', label: 'Bed and sleep', group: 'hard', maxCity: 6, maxResort: 6 },
  { key: 'tech', label: 'Tech', group: 'hard', maxCity: 2, maxResort: 2 },
  { key: 'amenities', label: 'Amenities and programming', group: 'hard', maxCity: 7, maxResort: 10 },
  { key: 'atmosphere', label: 'Atmosphere and public space', group: 'hard', maxCity: 10, maxResort: 10 },
  { key: 'maintenance', label: 'Maintenance and upkeep', group: 'hard', maxCity: 5, maxResort: 5 },
  { key: 'location', label: 'Location and setting', group: 'hard', maxCity: 7, maxResort: 4 },
  { key: 'checkIn', label: 'Check-in', group: 'soft', maxCity: 4, maxResort: 4 },
  { key: 'serviceBaseline', label: 'Service baseline', group: 'soft', maxCity: 10, maxResort: 10 },
  { key: 'servicePeak', label: 'Service peak', group: 'soft', maxCity: 5, maxResort: 5 },
  { key: 'operations', label: 'Operations', group: 'soft', maxCity: 5, maxResort: 5 },
  { key: 'housekeeping', label: 'Housekeeping', group: 'soft', maxCity: 5, maxResort: 5 },
  { key: 'breakfastAndDining', label: 'Breakfast and dining', group: 'soft', maxCity: 10, maxResort: 10 },
  { key: 'density', label: 'Density and capacity', group: 'soft', maxCity: 3, maxResort: 3 },
  { key: 'departure', label: 'Departure', group: 'soft', maxCity: 3, maxResort: 3 },
]

export const RUBRIC_KEYS = RUBRIC_V15.map((c) => c.key)

// The version before v15, which the reviews imported from Webflow were scored
// on. Same sixteen categories; Bed and sleep was out of 5 and Tech out of 3
// (the input sheet's column headers still carry those caps). Hard still 55.
export const RUBRIC_PRE_V15: RubricCategory[] = RUBRIC_V15.map((c) => {
  if (c.key === 'bedAndSleep') return { ...c, maxCity: 5, maxResort: 5 }
  if (c.key === 'tech') return { ...c, maxCity: 3, maxResort: 3 }
  return c
})
