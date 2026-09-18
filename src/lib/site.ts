// Site-wide constants. Editorial facts that are not (yet) content.
export const SITE = {
  name: 'Loyalist Travel',
  author: 'The Loyalist', // pen name; the site never carries a real name
  rubricNote: 'Scores follow the Loyalist Travel rubric, v15. No paid placements, no sponsored stays.',
}

export const NAV_LINKS = [
  { href: '/reviews', label: 'Reviews' },
  { href: '/hotels', label: 'Hotels' },
  { href: '/lounges', label: 'Lounges' },
  { href: '/programs', label: 'Programs' },
  { href: '/guides', label: 'Articles' },
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
