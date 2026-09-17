// Site-wide constants. Editorial facts that are not (yet) content.
export const SITE = {
  name: 'Loyalist Travel',
  author: 'Austin Shuxiao',
  rubricNote: 'Scores follow the Loyalist Travel rubric, v15. No paid placements, no sponsored stays.',
}

export const PROPERTY_TYPE_LABEL: Record<string, string> = { city: 'City hotel', resort: 'Resort' }

export const SEGMENT_LABEL: Record<string, string> = {
  'ultra-luxury': 'Ultra luxury',
  luxury: 'Luxury',
  upscale: 'Upscale',
  midscale: 'Midscale',
  budget: 'Budget',
  'extended-stay': 'Extended stay',
}

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
