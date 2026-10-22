// Site-wide constants. Editorial facts that are not (yet) content.
export const SITE = {
  name: 'Loyalist Travel',
  author: 'The Loyalist Traveler', // pen name; the site never carries a real name
  // the rubric every review is scored on: src/rubric/v16.ts
  rubricNote: 'Scores follow the Loyalist Travel rubric, v16. No paid placements, no sponsored stays.',
}

// The six sections of the site, as the header marks the current one.
export type NavSection = 'reviews' | 'hotels' | 'lounges' | 'programs' | 'news' | 'guides'

// The header menus: Programs, News and Guides open one; the rest are plain links.
export type NavMenu = 'programs' | 'news' | 'guides'

export type NavItem = { href: string; label: string; section: NavSection; menu?: NavMenu }

// The four programs, in the order they appear in the menu, the drawer and the footer.
export const PROGRAM_LINKS = [
  { href: '/programs/world-of-hyatt', label: 'World of Hyatt', slug: 'world-of-hyatt' },
  { href: '/programs/marriott-bonvoy', label: 'Marriott Bonvoy', slug: 'marriott-bonvoy' },
  { href: '/programs/hilton-honors', label: 'Hilton Honors', slug: 'hilton-honors' },
  { href: '/programs/ihg-one-rewards', label: 'IHG One Rewards', slug: 'ihg-one-rewards' },
]

// The header, in order. Programs has no page of its own: its menu lists the four, and
// /programs (the link without script) redirects to the homepage's Programs section.
export const NAV_LINKS: NavItem[] = [
  { href: '/reviews', label: 'Reviews', section: 'reviews' },
  { href: '/hotels', label: 'Hotels', section: 'hotels' },
  { href: '/lounges', label: 'Lounges', section: 'lounges' },
  { href: '/programs', label: 'Programs', section: 'programs', menu: 'programs' },
  { href: '/news', label: 'News', section: 'news', menu: 'news' },
  { href: '/guides', label: 'Guides', section: 'guides', menu: 'guides' },
]

// News and Guides are the two article sections: /news lists the articles carrying the
// category "news", /guides those carrying "guides" (main category or not). A topic narrows a
// section to the articles that also carry that category, as the query parameter `topic`
// with the category value: /news?topic=hotels, /news?topic=airlines, /guides?topic=credit-cards.
// No parameter means all of the section. The header menus, the phone drawer and the tabs on
// the News and Guides pages all build their links with these.
export const ARTICLE_SECTIONS = {
  news: { href: '/news', label: 'News', all: 'All news', latest: 'Latest news' },
  guides: { href: '/guides', label: 'Guides', all: 'All guides', latest: 'Latest guides' },
} as const
export type ArticleSection = keyof typeof ARTICLE_SECTIONS

export const TOPIC_PARAM = 'topic'

export const ARTICLE_TOPICS = [
  { value: 'hotels', label: 'Hotels' },
  { value: 'airlines', label: 'Airlines' },
  { value: 'credit-cards', label: 'Credit cards' },
] as const
export type ArticleTopic = (typeof ARTICLE_TOPICS)[number]['value']

export const topicHref = (section: ArticleSection, topic?: string | null) => (topic ? `${ARTICLE_SECTIONS[section].href}?${TOPIC_PARAM}=${topic}` : ARTICLE_SECTIONS[section].href)

// An article category as the site writes it in story rows and bylines, sentence case
// ("Credit cards"; the admin's list says "Credit Cards").
export const categoryName = (value?: string | null): string | null =>
  value ? ((ARTICLE_SECTIONS as Record<string, { label: string }>)[value]?.label ?? ARTICLE_TOPICS.find((t) => t.value === value)?.label ?? value) : null

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
