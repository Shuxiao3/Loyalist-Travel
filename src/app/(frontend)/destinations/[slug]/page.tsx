import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BrowseSide, SideLinks, SideReviews, StayBox } from '@/components/BrowseSide'
import { HotelTable, HotelTableNote } from '@/components/HotelTable'
import { PageNumbers } from '@/components/PageNumbers'
import { RichText } from '@/components/RichText'
import { rel } from '@/lib/format'
import { browseHotels, hotelRowExtras, loungesIn, moreInCountry, programsIn } from '@/lib/hotelBrowse'
import { getDestination, getPayloadClient } from '@/lib/queries'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import type { Hotel, Program, Region } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDestination((await params).slug)
  if (!d) return {}
  const text = metaText((await getSeo())?.destination, { Destination: d.name, Country: d.country, Description: d.shortDescription }, { title: `Hotels in ${d.name}`, description: d.shortDescription })
  return pageMeta({ title: d.seo?.title ?? text.title, description: d.seo?.description ?? text.description, path: `/destinations/${d.slug}`, image: d.imageUrl })
}

// A destination (mockup: destination.html). The band carries the breadcrumb, the place, its
// line and region, and a tab per program with a hotel here. Below: the hotels in a table
// (most stays reported first), and a side column of the site's reviews here, the club lounges,
// other places in the same country and the "Add your stay" box. No counts.
export default async function DestinationPage({ params, searchParams }: Props) {
  const destination = await getDestination((await params).slug)
  if (!destination) notFound()
  const sp = await searchParams
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1)
  const region = rel<Region>(destination.region)
  const country = destination.country?.trim() || null

  const programs = await programsIn(destination.id)
  // a program tab, when it names one of the programs here
  const program = programs.find((p) => p.slug === first(sp.program))?.slug
  const payload = await getPayloadClient()
  const [hotels, reviews, lounges, more] = await Promise.all([
    browseHotels(program ? { and: [{ destination: { equals: destination.id } }, { 'program.slug': { equals: program } }] } : { destination: { equals: destination.id } }, page),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.destination': { equals: destination.id } }] }, sort: '-publishedDate', depth: 2, limit: 6 }),
    loungesIn(destination.id),
    country ? moreInCountry(country, destination.id) : Promise.resolve([]),
  ])
  const href = (p: { program?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (p.program) q.set('program', p.program)
    if (p.page && p.page > 1) q.set('page', String(p.page))
    const s = q.toString()
    return `/destinations/${destination.slug}${s ? `?${s}` : ''}`
  }
  // a page past the end goes to the first page (past the end, the count reads zero)
  if (hotels.docs.length === 0 && page > 1) redirect(href({ program }))
  const rows = await hotelRowExtras(hotels.docs)
  const filterHref = (() => {
    const q = new URLSearchParams()
    if (program) q.set('program', program)
    if (country) q.set('country', country)
    const s = q.toString()
    return s ? `/hotels?${s}` : '/hotels'
  })()
  const meta = [region?.name, country].filter(Boolean).join(' · ')

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/hotels">Hotels</Link>
            {country && (
              <>
                <span className="sep">/</span>
                <span>{country}</span>
              </>
            )}
            <span className="sep">/</span>
            <span aria-current="page">{destination.name}</span>
          </nav>
          <div className="pb-row">
            <div className="pb-title">
              <h1>{destination.name}</h1>
              {destination.shortDescription && <p className="pb-dek">{destination.shortDescription}</p>}
              {meta && <p className="pb-meta">{meta}</p>}
            </div>
          </div>
          {programs.length > 1 && (
            <nav className="tabs" aria-label="Programs">
              <Link className={!program ? 'on' : undefined} aria-current={!program ? 'page' : undefined} href={href({})}>
                All
              </Link>
              {programs.map((p) => {
                const on = program === p.slug
                return (
                  <Link key={p.slug} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} href={href({ program: p.slug })}>
                    {p.name}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </section>

      <main className="wrap main">
        <div className="grid-side">
          <div>
            {destination.overview && (
              <section className={styles.overview}>
                <RichText data={destination.overview} />
              </section>
            )}
            <section className="mod" aria-labelledby="hotels-h">
              <div className="mod-head">
                <h2 id="hotels-h">Hotels in {destination.name}</h2>
                <Link href={filterHref}>Filter and sort</Link>
              </div>
              {hotels.docs.length > 0 ? (
                <>
                  <HotelTable hotels={hotels.docs} extras={rows} caption={`Hotels in ${destination.name}`} columns={{ brand: true, program: true, segment: true }} />
                  <HotelTableNote />
                </>
              ) : (
                <p className="empty">No published hotels here yet.</p>
              )}
              <PageNumbers page={hotels.page ?? 1} totalPages={hotels.totalPages} href={(p) => href({ program, page: p })} />
            </section>
          </div>

          <BrowseSide>
            <SideReviews
              id="reviews-h"
              title={`Our ${destination.name} reviews`}
              reviews={reviews.docs.map((r) => {
                const hotel = rel<Hotel>(r.hotel)
                return { slug: r.slug, title: r.title, score: r.totals?.overall ?? null, stayDate: r.stayDate, verdict: r.shortVerdict, place: rel<Program>(hotel?.program)?.name ?? null }
              })}
            />
            <SideLinks
              id="lounges-h"
              title={`Club lounges in ${destination.name}`}
              link={{ href: '/lounges', label: 'All lounges' }}
              rows={lounges.map((l) => ({ href: `/lounges/${l.slug}`, name: l.name, meta: [l.program, l.access].filter(Boolean).join(' · ') }))}
            />
            {country && <SideLinks id="more-h" title={`More in ${country}`} link={{ href: `/hotels?country=${encodeURIComponent(country)}`, label: `All hotels in ${country}` }} rows={more.map((d) => ({ href: `/destinations/${d.slug}`, name: d.name }))} />}
            <StayBox id="stay-h" title={`Stayed in ${destination.name}?`} />
          </BrowseSide>
        </div>
      </main>
    </>
  )
}
