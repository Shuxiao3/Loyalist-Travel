import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ReferenceBody } from '@/components/ReferenceBody'
import { ReferenceHero } from '@/components/ReferenceHero'
import { count } from '@/lib/format'
import { getHotelsIn, getPayloadClient, getProgram } from '@/lib/queries'
import type { StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProgram((await params).slug)
  return p ? { title: p.seo?.title ?? p.name, description: p.seo?.description ?? p.shortDescription ?? undefined } : {}
}

export default async function ProgramPage({ params }: Props) {
  const program = await getProgram((await params).slug)
  if (!program) notFound()
  const payload = await getPayloadClient()
  const [hotels, reviews, tiers] = await Promise.all([
    getHotelsIn({ program: { equals: program.id } }, 60),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.program': { equals: program.id } }] }, sort: '-publishedDate', depth: 1, limit: 6 }),
    payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 10, depth: 0 }),
  ])
  const levels: StatusLevel[] = tiers.docs
  return (
    <>
      <ReferenceHero
        eyebrow="Loyalty program"
        title={program.name}
        sub={program.shortDescription}
        crumbs={[{ href: '/hotels', label: 'Hotels' }, { href: `/programs/${program.slug}`, label: program.name }]}
        stats={[
          { n: count(hotels.totalDocs), l: 'Hotels indexed' },
          { n: count(reviews.totalDocs), l: 'Scored stays' },
          { n: String(levels.length), l: 'Elite tiers' },
          ...(program.topTierName ? [{ n: program.topTierName, l: 'Top tier' }] : []),
        ]}
      />

      {levels.length > 0 && (
        <section className={`section ${styles.tiers}`} aria-labelledby="tiers-h">
          <div className="wrap">
            <span className="eyebrow on-light" id="tiers-h">
              Elite tiers
            </span>
            <div className="grid-cells">
              {levels.map((t) => (
                <div className="cell" key={t.id}>
                  <span className="label">{t.nights ?? `Tier ${t.rank ?? ''}`}</span>
                  <span className="val">
                    <b className={styles.tierName}>{t.shortName ?? t.name}</b>
                    {t.shortDescription ? ` ${t.shortDescription}` : ''}
                  </span>
                  <span className={styles.perks}>
                    {[t.eligibility?.breakfast && 'Breakfast', t.eligibility?.lounge && 'Lounge', t.eligibility?.suiteUpgrade && 'Suite upgrades', t.eligibility?.lateCheckout && 'Late checkout']
                      .filter(Boolean)
                      .join(' · ') || 'No printed elite benefits'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <ReferenceBody overview={program.overview} reviews={reviews.docs} hotels={hotels.docs} hotelsTotal={hotels.totalDocs} hotelsHref={`/hotels?program=${program.slug}`} name={program.name} />
    </>
  )
}
