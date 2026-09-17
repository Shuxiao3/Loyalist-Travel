import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ReferenceBody } from '@/components/ReferenceBody'
import { ReferenceHero } from '@/components/ReferenceHero'
import { count, rel } from '@/lib/format'
import { getDestination, getHotelsIn, getPayloadClient } from '@/lib/queries'
import type { Region } from '@/payload-types'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDestination((await params).slug)
  return d ? { title: d.seo?.title ?? `Hotels in ${d.name}`, description: d.seo?.description ?? d.shortDescription ?? undefined } : {}
}

export default async function DestinationPage({ params }: Props) {
  const destination = await getDestination((await params).slug)
  if (!destination) notFound()
  const region = rel<Region>(destination.region)
  const payload = await getPayloadClient()
  const [hotels, reviews] = await Promise.all([
    getHotelsIn({ destination: { equals: destination.id } }, 60),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.destination': { equals: destination.id } }] }, sort: '-publishedDate', depth: 1, limit: 6 }),
  ])
  return (
    <>
      <ReferenceHero
        eyebrow={[region?.name, destination.country].filter(Boolean).join(' · ') || 'Destination'}
        title={destination.name}
        sub={destination.shortDescription ?? destination.locationLabel}
        crumbs={[{ href: '/hotels', label: 'Hotels' }, { href: `/destinations/${destination.slug}`, label: destination.name }]}
        stats={[
          { n: count(hotels.totalDocs), l: 'Hotels indexed' },
          { n: count(reviews.totalDocs), l: 'Scored stays' },
        ]}
      />
      <ReferenceBody overview={destination.overview} reviews={reviews.docs} hotels={hotels.docs} hotelsTotal={hotels.totalDocs} hotelsHref={`/hotels?country=${encodeURIComponent(destination.country ?? '')}`} name={destination.name} />
    </>
  )
}
