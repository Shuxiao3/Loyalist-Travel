import type { MetadataRoute } from 'next'

import { getPayloadClient } from '@/lib/payload'
import { SITE_URL } from '@/lib/seo'

export const revalidate = 3600

type Row = { slug: string; updatedAt: string }

// Every public page: the fixed ones, then each published record by slug.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()
  const published = { _status: { equals: 'published' as const } }
  const list = async (collection: 'hotels' | 'reviews' | 'articles' | 'lounges' | 'destinations', where = published) =>
    (await payload.find({ collection, where, limit: 20000, depth: 0, select: { slug: true, updatedAt: true }, pagination: false })).docs as Row[]
  const [hotels, reviews, articles, lounges, destinations, programs, brands] = await Promise.all([
    list('hotels'),
    list('reviews'),
    list('articles'),
    list('lounges'),
    list('destinations'),
    (await payload.find({ collection: 'programs', limit: 50, depth: 0, select: { slug: true, updatedAt: true } })).docs as Row[],
    (await payload.find({ collection: 'brands', limit: 500, depth: 0, select: { slug: true, updatedAt: true } })).docs as Row[],
  ])
  const entry = (path: string, updatedAt?: string, priority = 0.5, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'weekly') => ({
    url: `${SITE_URL}${path}`,
    lastModified: updatedAt ? new Date(updatedAt) : new Date(),
    changeFrequency,
    priority,
  })
  return [
    entry('/', undefined, 1, 'daily'),
    entry('/reviews', undefined, 0.9, 'daily'),
    entry('/hotels', undefined, 0.8, 'daily'),
    entry('/lounges', undefined, 0.8, 'weekly'),
    entry('/programs', undefined, 0.7, 'monthly'),
    entry('/articles', undefined, 0.8, 'daily'),
    entry('/submit-a-stay', undefined, 0.5, 'monthly'),
    ...reviews.map((r) => entry(`/reviews/${r.slug}`, r.updatedAt, 0.9, 'monthly')),
    ...articles.map((a) => entry(`/articles/${a.slug}`, a.updatedAt, 0.8, 'monthly')),
    ...lounges.map((l) => entry(`/lounges/${l.slug}`, l.updatedAt, 0.7, 'weekly')),
    ...programs.map((p) => entry(`/programs/${p.slug}`, p.updatedAt, 0.7, 'monthly')),
    ...brands.map((b) => entry(`/brands/${b.slug}`, b.updatedAt, 0.4, 'monthly')),
    ...destinations.map((d) => entry(`/destinations/${d.slug}`, d.updatedAt, 0.4, 'monthly')),
    ...hotels.map((h) => entry(`/hotels/${h.slug}`, h.updatedAt, 0.5, 'weekly')),
  ]
}
