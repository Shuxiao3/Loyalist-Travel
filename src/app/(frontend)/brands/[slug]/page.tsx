import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ReferenceBody } from '@/components/ReferenceBody'
import { ReferenceHero } from '@/components/ReferenceHero'
import { count, rel } from '@/lib/format'
import { getBrand, getHotelsIn, getPayloadClient } from '@/lib/queries'
import type { Program } from '@/payload-types'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand((await params).slug)
  return brand ? { title: brand.name, description: brand.shortDescription ?? undefined } : {}
}

export default async function BrandPage({ params }: Props) {
  const brand = await getBrand((await params).slug)
  if (!brand) notFound()
  const program = rel<Program>(brand.program)
  const payload = await getPayloadClient()
  const [hotels, reviews] = await Promise.all([
    getHotelsIn({ brand: { equals: brand.id } }, 60),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.brand': { equals: brand.id } }] }, sort: '-publishedDate', depth: 1, limit: 6 }),
  ])
  return (
    <>
      <ReferenceHero
        eyebrow={program?.name ?? 'Brand'}
        title={brand.name}
        sub={brand.shortDescription}
        crumbs={[{ href: '/hotels', label: 'Hotels' }, ...(program ? [{ href: `/programs/${program.slug}`, label: program.name }] : []), { href: `/brands/${brand.slug}`, label: brand.name }]}
        stats={[
          { n: count(hotels.totalDocs), l: 'Hotels indexed' },
          { n: count(reviews.totalDocs), l: 'Scored stays' },
        ]}
      />
      <ReferenceBody overview={brand.overview} reviews={reviews.docs} hotels={hotels.docs} hotelsTotal={hotels.totalDocs} hotelsHref={`/hotels?brand=${brand.slug}`} name={brand.name} />
    </>
  )
}
