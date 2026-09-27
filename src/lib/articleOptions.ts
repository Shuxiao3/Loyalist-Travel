// Article categories. Lives here, not in the collection file, so client
// components (the header menu) can import it without pulling in Payload.
export const ARTICLE_CATEGORIES = [
  { label: 'Elite benefits', value: 'elite-benefits' },
  { label: 'Programs', value: 'programs' },
  { label: 'Points & awards', value: 'points-awards' },
  { label: 'Credit cards', value: 'credit-cards' },
  { label: 'Hotels & lounges', value: 'hotels-lounges' },
]
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]['value']
export const ARTICLE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]))
