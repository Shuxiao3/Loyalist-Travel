// Article queries. Published only on the public side.

import type { Where } from 'payload'

import type { Article } from '@/payload-types'

import { getPayloadClient } from './payload'

const published: Where = { _status: { equals: 'published' } }

export const ARTICLES_PER_PAGE = 12

export async function getArticles(opts: { limit?: number; page?: number; category?: string; excludeId?: number; featuredFirst?: boolean } = {}) {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  // any article carrying the category, main or not
  if (opts.category) and.push({ categories: { in: [opts.category] } })
  if (opts.excludeId) and.push({ id: { not_equals: opts.excludeId } })
  return payload.find({
    collection: 'articles',
    where: { and },
    sort: opts.featuredFirst ? ['-featured', '-publishedDate'] : '-publishedDate',
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

// How many published articles sit in each category, for the hub chips. An
// article counts once in every category it carries, so the total of all
// articles is counted on its own.
export async function getArticleCategoryCounts(): Promise<{ total: number; counts: Record<string, number> }> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'articles', where: published, limit: 2000, depth: 0, select: { categories: true } })
  const counts: Record<string, number> = {}
  for (const a of res.docs) for (const c of new Set(a.categories ?? [])) counts[c] = (counts[c] ?? 0) + 1
  return { total: res.totalDocs, counts }
}

export function articleImage(a: Article): string | null {
  const media = a.heroImage && typeof a.heroImage === 'object' ? a.heroImage.staticUrl || a.heroImage.url : null
  return media ?? a.externalImageUrl ?? null
}
