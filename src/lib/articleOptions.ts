// Article categories. Lives here, not in the collection file, so client
// components (the header menu) can import it without pulling in Payload.
export const ARTICLE_CATEGORIES = [
  { label: 'News', value: 'news' },
  { label: 'Guides', value: 'guides' },
  { label: 'Hotels', value: 'hotels' },
  { label: 'Airlines', value: 'airlines' },
  { label: 'Credit Cards', value: 'credit-cards' },
] as const satisfies readonly { label: string; value: string }[]
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]['value']
export const ARTICLE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]))
export const isArticleCategory = (v: unknown): v is ArticleCategory => ARTICLE_CATEGORIES.some((c) => c.value === v)

// The categories the site published before these five, as the nav linked
// them on every page; the hub sends each on to the category it became.
export const LEGACY_ARTICLE_CATEGORY: Record<string, ArticleCategory> = {
  'elite-benefits': 'guides',
  programs: 'guides',
  'points-awards': 'guides',
  'hotels-lounges': 'hotels',
}
