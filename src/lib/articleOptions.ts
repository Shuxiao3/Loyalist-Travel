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
export const articleCategoryLabel = (v: string | null | undefined) => (v ? (ARTICLE_CATEGORY_LABEL[v] ?? v) : undefined)

// An article's first category is its main one: cards and the breadcrumb
// show it, it fills {Category} in the SEO settings' article template, and
// the article page lists the rest after it.
export const mainArticleCategory = (a: { categories?: readonly string[] | null }) => a.categories?.[0]

// The categories the site published before these five, as the nav linked
// them on every page; the hub sends each on to the category it became.
export const LEGACY_ARTICLE_CATEGORY: Record<string, ArticleCategory> = {
  'elite-benefits': 'guides',
  programs: 'guides',
  'points-awards': 'guides',
  'hotels-lounges': 'hotels',
}

// The section an article sits in, News or Guides (the header marks it, the breadcrumb leads to
// it): whichever of the two its categories name first. An article carrying neither counts as a
// guide.
export type ArticleSectionKey = 'news' | 'guides'
export const articleSection = (a: { categories?: readonly string[] | null }): ArticleSectionKey =>
  (a.categories ?? []).find((c): c is ArticleSectionKey => c === 'news' || c === 'guides') ?? 'guides'
