// Article queries. Published only on the public side.

import type { Where } from 'payload'

import type { Article } from '@/payload-types'

import { getPayloadClient } from './payload'

const published: Where = { _status: { equals: 'published' } }

export const ARTICLES_PER_PAGE = 12

// category: articles carrying it, main or not. categories: articles carrying every one of them
// (a section and a topic: /news?topic=airlines is news that is also about airlines).
export async function getArticles(opts: { limit?: number; page?: number; category?: string; categories?: string[]; excludeId?: number; featuredFirst?: boolean } = {}) {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  const [one, ...more] = [...new Set([opts.category, ...(opts.categories ?? [])])].filter((c): c is string => Boolean(c))
  // any article carrying the category, main or not
  if (one) and.push({ categories: { in: [one] } })
  // Two conditions on the categories would both test the same category row (Postgres joins the
  // list once), so each further category narrows by the ids of the articles that carry it.
  for (const c of more) {
    const carrying = await payload.find({ collection: 'articles', where: { and: [published, { categories: { in: [c] } }] }, depth: 0, pagination: false, select: {} })
    and.push({ id: { in: carrying.docs.map((d) => d.id) } })
  }
  if (opts.excludeId) and.push({ id: { not_equals: opts.excludeId } })
  return payload.find({
    collection: 'articles',
    where: { and },
    // the newer record first between articles of the same date, so every list agrees
    sort: opts.featuredFirst ? ['-featured', '-publishedDate', '-id'] : ['-publishedDate', '-id'],
    depth: 1,
    limit: opts.limit ?? ARTICLES_PER_PAGE,
    page: opts.page ?? 1,
  })
}

export async function getArticle(slug: string): Promise<Article | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'articles', where: { and: [{ slug: { equals: slug } }, published] }, depth: 2, limit: 1 })
  return res.docs[0] ?? null
}

export function articleImage(a: Article): string | null {
  const media = a.heroImage && typeof a.heroImage === 'object' ? a.heroImage.staticUrl || a.heroImage.url : null
  return media ?? a.externalImageUrl ?? null
}
