// The Loyalist Travel rubric, version 15. Locked on Sep 16 2026; later
// changes become v16 (decision log, content model 1). Sixteen categories,
// eight hard and eight soft, 100 points at a city hotel.
//
// City maxima are from the proof page (docs/park-hyatt-new-york-review.html).
// Resort maxima are not yet recorded and are validated only once set in the
// Rubric Versions record.

export type RubricGroup = 'hard' | 'soft'

export type RubricCategory = {
  key: string
  label: string
  group: RubricGroup
  maxCity: number | null
  maxResort: number | null
}

export const RUBRIC_V15: RubricCategory[] = [
  { key: 'roomLayout', label: 'Room layout', group: 'hard', maxCity: 10, maxResort: null },
  { key: 'bathroom', label: 'Bathroom', group: 'hard', maxCity: 8, maxResort: null },
  { key: 'bedAndSleep', label: 'Bed and sleep', group: 'hard', maxCity: 6, maxResort: null },
  { key: 'tech', label: 'Tech', group: 'hard', maxCity: 2, maxResort: null },
  { key: 'amenities', label: 'Amenities and programming', group: 'hard', maxCity: 7, maxResort: null },
  { key: 'atmosphere', label: 'Atmosphere and public space', group: 'hard', maxCity: 10, maxResort: null },
  { key: 'maintenance', label: 'Maintenance and upkeep', group: 'hard', maxCity: 5, maxResort: null },
  { key: 'location', label: 'Location and setting', group: 'hard', maxCity: 7, maxResort: null },
  { key: 'checkIn', label: 'Check-in', group: 'soft', maxCity: 4, maxResort: null },
  { key: 'serviceBaseline', label: 'Service baseline', group: 'soft', maxCity: 10, maxResort: null },
  { key: 'servicePeak', label: 'Service peak', group: 'soft', maxCity: 5, maxResort: null },
  { key: 'operations', label: 'Operations', group: 'soft', maxCity: 5, maxResort: null },
  { key: 'housekeeping', label: 'Housekeeping', group: 'soft', maxCity: 5, maxResort: null },
  { key: 'breakfastAndDining', label: 'Breakfast and dining', group: 'soft', maxCity: 10, maxResort: null },
  { key: 'density', label: 'Density and capacity', group: 'soft', maxCity: 3, maxResort: null },
  { key: 'departure', label: 'Departure', group: 'soft', maxCity: 3, maxResort: null },
]

export const RUBRIC_KEYS = RUBRIC_V15.map((c) => c.key)
