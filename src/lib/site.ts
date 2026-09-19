import { ARTICLE_CATEGORIES } from './articleOptions'

// Site-wide constants. Editorial facts that are not (yet) content.
export const SITE = {
  name: 'Loyalist Travel',
  author: 'Anonymous Loyalist', // pen name; the site never carries a real name
  rubricNote: 'Scores follow the Loyalist Travel rubric, v15. No paid placements, no sponsored stays.',
}

export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] }

// The four programs, in the order they appear in the menu.
export const PROGRAM_LINKS = [
  { href: '/programs/world-of-hyatt', label: 'World of Hyatt' },
  { href: '/programs/marriott-bonvoy', label: 'Marriott Bonvoy' },
  { href: '/programs/hilton-honors', label: 'Hilton Honors' },
  { href: '/programs/ihg-one-rewards', label: 'IHG One Rewards' },
]

// Programs has no page of its own: the menu opens straight to the four.
// Articles opens to its categories.
export const NAV_LINKS: NavItem[] = [
  { href: '/reviews', label: 'Reviews' },
  { href: '/hotels', label: 'Hotels' },
  { href: '/lounges', label: 'Lounges' },
  { href: '/programs', label: 'Programs', children: PROGRAM_LINKS },
  { href: '/articles', label: 'Articles', children: ARTICLE_CATEGORIES.map((c) => ({ href: `/articles?category=${c.value}`, label: c.label })) },
]

export const PROPERTY_TYPE_LABEL: Record<string, string> = { city: 'City hotel', resort: 'Resort' }

export const RATE_BASIS_LABEL: Record<string, string> = {
  cash: 'Cash',
  points: 'Points',
  certificate: 'Free night certificate',
  'credit-card-portal': 'Credit card portal',
  'third-party': 'Third party',
  'corporate-rate': 'Corporate rate',
  'guest-of-honor': 'Guest of Honor',
  other: 'Other',
}
