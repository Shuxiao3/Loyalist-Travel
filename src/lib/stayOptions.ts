// Answer lists for reader stays. Plain data, safe to import from client
// components; the collection re-exports them.

export const UPGRADE_OUTCOMES = [
  { label: 'No', value: 'none' },
  { label: 'Yes', value: 'yes' },
  { label: 'Used a suite upgrade award', value: 'award' },
]

export const UPGRADE_TYPES = [
  { label: 'Higher floor', value: 'floor' },
  { label: 'Better view', value: 'view' },
  { label: 'Higher room category', value: 'category' },
  { label: 'Suite', value: 'suite' },
]

export const SUITE_TYPES = [
  { label: 'Junior suite', value: 'junior' },
  { label: 'One-bedroom suite', value: 'one-bedroom' },
  { label: 'Two-bedroom suite', value: 'two-bedroom' },
  { label: 'Specialty suite', value: 'specialty' },
]

export const UPGRADE_HOW = [
  { label: 'Offered without asking', value: 'proactive' },
  { label: 'Given when I asked', value: 'asked' },
]

export const BREAKFAST_OUTCOMES = [
  { label: 'Full: buffet and à la carte', value: 'full' },
  { label: 'Buffet only', value: 'buffet' },
  { label: 'À la carte only', value: 'a-la-carte' },
  { label: 'Restaurant or F&B credit', value: 'credit' },
  { label: 'Not honoured', value: 'not-honoured' },
  { label: 'Not eligible', value: 'not-eligible' },
]

export const ALA_CARTE_CAP = [
  { label: 'Uncapped', value: 'uncapped' },
  { label: 'Capped', value: 'capped' },
]

export const LOUNGE_ACCESS = [
  { label: 'Given', value: 'given' },
  { label: 'Declined', value: 'declined' },
  { label: 'Did not use it', value: 'not-used' },
]

// The five things a reader scores about a lounge, each 1 to 5. Overall is
// its own score, not an average of the other four.
export const LOUNGE_FACTORS = [
  { name: 'food', label: 'Food' },
  { name: 'drink', label: 'Drink' },
  { name: 'space', label: 'Space and ambiance' },
  { name: 'service', label: 'Service' },
  { name: 'overall', label: 'Overall' },
] as const
export type LoungeFactor = (typeof LOUNGE_FACTORS)[number]['name']
export const LOUNGE_COMMENT_MAX = 600

export const LOUNGE_WORTH_IT = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

export const LATE_CHECKOUT_OUTCOMES = [
  { label: 'Honoured', value: 'honoured' },
  { label: 'Declined', value: 'declined' },
  { label: 'Not requested', value: 'not-requested' },
]
