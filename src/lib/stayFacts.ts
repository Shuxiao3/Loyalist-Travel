// The facts of one reported stay as short label and value pairs, in the
// order a stay shows them: status held, the upgrade and how it came, the
// rooms, then breakfast, lounge, late checkout and the welcome amenity.
// Anything the post did not say is left out. Plain data, so the import
// script uses it too: the short summaries it writes leave these out.

import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, LOUNGE_ACCESS, SUITE_TYPES, UPGRADE_TYPES } from './stayOptions'

export type StayFactsInput = {
  tier: string | null
  upgrade: string | null
  upgradeType?: string | null
  suiteType?: string | null
  upgradeHow?: string | null
  roomBooked?: string | null
  roomReceived?: string | null
  breakfast?: string | null
  loungeAccess?: string | null
  lateCheckout?: string | null
  welcomeAmenity?: string | null
}
export type StayFact = { label: string; value: string }

const labelOf = (list: readonly { label: string; value: string }[], v?: string | null) => list.find((o) => o.value === v)?.label ?? null

// "Suite: one-bedroom", "Better view", or just "Yes" when the post did not
// say what kind
function upgradeKind(s: StayFactsInput): string {
  if (s.upgradeType === 'suite' || s.upgrade === 'award') return labelOf(SUITE_TYPES, s.suiteType) ?? 'Suite'
  return labelOf(UPGRADE_TYPES, s.upgradeType) ?? 'Yes'
}

export function stayFacts(s: StayFactsInput): StayFact[] {
  const facts: StayFact[] = []
  if (s.tier) facts.push({ label: 'Status', value: s.tier })
  const how = s.upgradeHow === 'proactive' ? 'offered without asking' : s.upgradeHow === 'asked' ? 'after asking' : null
  if (s.upgrade === 'award') facts.push({ label: 'Upgrade', value: `${upgradeKind(s)}, with a suite upgrade award` })
  else if (s.upgrade === 'yes') facts.push({ label: 'Upgrade', value: [upgradeKind(s), how].filter(Boolean).join(', ') })
  else if (s.upgrade === 'none') facts.push({ label: 'Upgrade', value: s.upgradeHow === 'asked' ? 'None, though asked' : 'None' })
  const booked = s.roomBooked?.trim()
  const got = s.roomReceived?.trim()
  if (booked && got && booked.toLowerCase() !== got.toLowerCase()) facts.push({ label: 'Room', value: `${booked} → ${got}` })
  else if (got || booked) facts.push({ label: 'Room', value: (got || booked) as string })
  const breakfast = labelOf(BREAKFAST_OUTCOMES, s.breakfast)
  if (breakfast) facts.push({ label: 'Breakfast', value: breakfast })
  const lounge = labelOf(LOUNGE_ACCESS, s.loungeAccess)
  if (lounge) facts.push({ label: 'Lounge', value: lounge })
  const late = labelOf(LATE_CHECKOUT_OUTCOMES, s.lateCheckout)
  if (late) facts.push({ label: 'Late checkout', value: late })
  if (s.welcomeAmenity === 'given') facts.push({ label: 'Welcome amenity', value: 'Given' })
  else if (s.welcomeAmenity === 'not-given') facts.push({ label: 'Welcome amenity', value: 'Not given' })
  return facts
}
