// The Loyalist Travel rubric, version 16. Six categories, nineteen
// sub-scores, 100 points, no weights: every sub-score is out of 5 and the
// same for city hotels and resorts. Value and elite recognition are reported
// in the review and never scored.

export type SectionId = 'room' | 'property' | 'service' | 'operations' | 'breakfast' | 'atmosphere'

export type RubricSection = { id: SectionId; label: string; max: number }

export const RUBRIC_SECTIONS: RubricSection[] = [
  { id: 'room', label: 'Room', max: 20 },
  { id: 'property', label: 'Property', max: 20 },
  { id: 'service', label: 'Service', max: 20 },
  { id: 'operations', label: 'Operations', max: 10 },
  { id: 'breakfast', label: 'Breakfast', max: 10 },
  { id: 'atmosphere', label: 'Atmosphere', max: 20 },
]

export type RubricCategoryV16 = { key: string; label: string; section: SectionId; max: number; hint: string }

export const RUBRIC_V16: RubricCategoryV16[] = [
  { key: 'layout', label: 'Layout', section: 'room', max: 5, hint: 'Space, flow, storage, the desk and the chair.' },
  { key: 'bathroom', label: 'Bathroom', section: 'room', max: 5, hint: 'Shower, tub, counter space, amenities.' },
  { key: 'sleep', label: 'Sleep', section: 'room', max: 5, hint: 'Bed, linens, blackout, quiet.' },
  { key: 'tech', label: 'Tech', section: 'room', max: 5, hint: 'Lighting controls, outlets, television, connectivity.' },
  { key: 'publicSpace', label: 'Public space', section: 'property', max: 5, hint: 'Lobby, pool, gym, gardens: do they work and are they kept.' },
  { key: 'amenities', label: 'Amenities', section: 'property', max: 5, hint: 'Spa, programming, kids club, what the hotel offers beyond the room.' },
  { key: 'location', label: 'Location', section: 'property', max: 5, hint: 'Where it sits for what a guest is there to do.' },
  { key: 'maintenance', label: 'Maintenance', section: 'property', max: 5, hint: 'Wear, chips, stains, things that should have been fixed.' },
  { key: 'warmth', label: 'Warmth', section: 'service', max: 5, hint: 'Attitude. Friendly, present, the same at the bar as at the desk.' },
  { key: 'efficiency', label: 'Efficiency', section: 'service', max: 5, hint: 'Requests done right the first time, quickly, without chasing.' },
  { key: 'anticipation', label: 'Anticipation', section: 'service', max: 5, hint: 'Done before you asked. Preferences remembered.' },
  { key: 'arrival', label: 'Arrival and departure', section: 'service', max: 5, hint: 'Check-in, the walk to the room, checkout and the bill.' },
  { key: 'mistakes', label: 'Mistakes and recovery', section: 'operations', max: 5, hint: 'None is a 5. Fixed fast and generously is a 4. Argued about is a 1.' },
  { key: 'housekeeping', label: 'Housekeeping', section: 'operations', max: 5, hint: 'Cleanliness on arrival, daily service, turndown if offered.' },
  { key: 'breakfastQuality', label: 'Quality', section: 'breakfast', max: 5, hint: 'Cooking, ingredients, coffee, the à la carte.' },
  { key: 'breakfastSpread', label: 'Spread', section: 'breakfast', max: 5, hint: 'Range of the buffet, local dishes, dietary options, the room and the service.' },
  { key: 'design', label: 'Design', section: 'atmosphere', max: 5, hint: 'The idea. A point of view that hangs together.' },
  { key: 'finish', label: 'Finish', section: 'atmosphere', max: 5, hint: 'Materials and execution. Stone, wood, fabric, hardware, to the touch.' },
  { key: 'senseOfPlace', label: 'Sense of place', section: 'atmosphere', max: 5, hint: 'Does it belong to its city or country, or could it be anywhere.' },
  { key: 'crowding', label: 'Crowds and exclusivity', section: 'atmosphere', max: 5, hint: 'Who else is there, and how many.' },
]

export const RUBRIC_V16_KEYS = RUBRIC_V16.map((c) => c.key)

export const sectionOf = (id: SectionId) => RUBRIC_SECTIONS.find((s) => s.id === id)!
export const keysIn = (id: SectionId) => RUBRIC_V16.filter((c) => c.section === id).map((c) => c.key)

// An old score sheet read across to v16: each old category scaled to 5 and
// rounded to the half point; sub-scores the old sheet never had take the
// closest old measure. The Webflow reviews are on the pre-v15 sheet (Bed and
// sleep out of 5, Tech out of 3). A first pass only; a re-score replaces it.
export function convertV15ToV16(old: Record<string, number | null | undefined>, propertyType: 'city' | 'resort', sheet: 'v15' | 'pre-v15' = 'pre-v15'): Record<string, number | null> {
  const s = (v: number | null | undefined, max: number) => (v == null ? null : Math.min(5, Math.round((v / max) * 5 * 2) / 2))
  const resort = propertyType === 'resort'
  const atmosphere = s(old.atmosphere, 10)
  const baseline = s(old.serviceBaseline, 10)
  const breakfast = s(old.breakfastAndDining, 10)
  const checkIn = s(old.checkIn, 4)
  const departure = s(old.departure, 3)
  return {
    layout: s(old.roomLayout, 10),
    bathroom: s(old.bathroom, 8),
    sleep: s(old.bedAndSleep, sheet === 'pre-v15' ? 5 : 6),
    tech: s(old.tech, sheet === 'pre-v15' ? 3 : 2),
    publicSpace: atmosphere,
    amenities: s(old.amenities, resort ? 10 : 7),
    location: s(old.location, resort ? 4 : 7),
    maintenance: s(old.maintenance, 5),
    warmth: baseline,
    efficiency: baseline,
    anticipation: s(old.servicePeak, 5),
    arrival: checkIn == null ? departure : departure == null ? checkIn : Math.round(((checkIn + departure) / 2) * 2) / 2,
    mistakes: s(old.operations, 5),
    housekeeping: s(old.housekeeping, 5),
    breakfastQuality: breakfast,
    breakfastSpread: breakfast,
    design: atmosphere,
    finish: atmosphere,
    senseOfPlace: atmosphere,
    crowding: s(old.density, 3),
  }
}

// Where each v15 narrative lands in v16. Departure joins arrival.
export const V15_NARRATIVE_TO_V16: Record<string, string> = {
  roomLayout: 'layout',
  bathroom: 'bathroom',
  bedAndSleep: 'sleep',
  tech: 'tech',
  atmosphere: 'publicSpace',
  amenities: 'amenities',
  location: 'location',
  maintenance: 'maintenance',
  checkIn: 'arrival',
  departure: 'arrival',
  serviceBaseline: 'warmth',
  servicePeak: 'anticipation',
  operations: 'mistakes',
  housekeeping: 'housekeeping',
  breakfastAndDining: 'breakfastQuality',
  density: 'crowding',
}
