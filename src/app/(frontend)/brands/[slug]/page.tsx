import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BrowseSide, SideLinks, SideReviews, StayBox } from '@/components/BrowseSide'
import { CurrentTabInView } from '@/components/CurrentTabInView'
import { HotelTable, HotelTableNote } from '@/components/HotelTable'
import { PageNumbers } from '@/components/PageNumbers'
import { RichText } from '@/components/RichText'
import { rel } from '@/lib/format'
import { browseHotels, hotelRowExtras, regionsOf, siblingBrands } from '@/lib/hotelBrowse'
import { getBrand, getPayloadClient, topTierOf } from '@/lib/queries'
import { reviewPhoto } from '@/lib/photos'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import type { Destination, Hotel, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

// The box's question: "Stayed at a Park Hyatt?", "Stayed at an Andaz?"; a brand named as a group
// ("Marriott Hotels", "The Luxury Collection") asks about its hotels instead
function stayQuestion(name: string): string {
  if (/^the\s/i.test(name) || /\b(hotels|resorts|collection|portfolio|suites|world)\b/i.test(name)) return 'Stayed at one of these hotels?'
  return `Stayed at ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}?`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand((await params).slug)
  if (!brand) return {}
  const text = metaText((await getSeo())?.brand, { Brand: brand.name, Program: rel<Program>(brand.program)?.name, Elite: await topTierOf(rel<Program>(brand.program)), Description: brand.shortDescription }, { title: brand.name, description: brand.shortDescription })
  return pageMeta({ ...text, path: `/brands/${brand.slug}` })
}

// A brand (mockup: brand.html). The band carries the breadcrumb, the brand, its line, its
// program, and a tab per region with one of its hotels. Below: the hotels in a table
// (most stays reported first), and a side column of the site's reviews of them, the program's
// other brands and the "Add your stay" box. No counts.
export default async function BrandPage({ params, searchParams }: Props) {
  const brand = await getBrand((await params).slug)
  if (!brand) notFound()
  const sp = await searchParams
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1)
  const program = rel<Program>(brand.program)

  const regions = await regionsOf(brand.id)
  // a region tab, when it names one of the regions with a hotel of this brand
  const region = regions.find((r) => r.slug === first(sp.region))?.slug
  const payload = await getPayloadClient()
  const [hotels, reviews, siblings] = await Promise.all([
    browseHotels(region ? { and: [{ brand: { equals: brand.id } }, { 'destination.region.slug': { equals: region } }] } : { brand: { equals: brand.id } }, page),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.brand': { equals: brand.id } }] }, sort: '-publishedDate', depth: 2, limit: 6 }),
    program ? siblingBrands(program.id, brand.id) : Promise.resolve([]),
  ])
  const href = (p: { region?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (p.region) q.set('region', p.region)
    if (p.page && p.page > 1) q.set('page', String(p.page))
    const s = q.toString()
    return `/brands/${brand.slug}${s ? `?${s}` : ''}`
  }
  // a page past the end goes to the first page (past the end, the count reads zero)
  if (hotels.docs.length === 0 && page > 1) redirect(href({ region }))
  const rows = await hotelRowExtras(hotels.docs)
  const filterHref = `/hotels?brand=${encodeURIComponent(brand.slug)}${region ? `&region=${encodeURIComponent(region)}` : ''}`

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/hotels">Hotels</Link>
            {program && (
              <>
                <span className="sep">/</span>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
              </>
            )}
            <span className="sep">/</span>
            <span aria-current="page">{brand.name}</span>
          </nav>
          <div className="pb-row">
            <div className="pb-title">
              <h1>{brand.name}</h1>
              {brand.shortDescription && <p className="pb-dek">{brand.shortDescription}</p>}
              {program && (
                <p className={`pb-meta ${styles.meta}`}>
                  <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                </p>
              )}
            </div>
          </div>
          {regions.length > 1 && (
            <nav className="tabs tabs-bleed" aria-label="Regions">
              <Link className={!region ? 'on' : undefined} aria-current={!region ? 'page' : undefined} href={href({})}>
                All
              </Link>
              {regions.map((r) => {
                const on = region === r.slug
                return (
                  <Link key={r.slug} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} href={href({ region: r.slug })}>
                    {r.name}
                  </Link>
                )
              })}
            </nav>
          )}
          <CurrentTabInView current={region} />
        </div>
      </section>

      <main className="wrap main">
        <div className="grid-side">
          <div>
            {brand.overview && (
              <section className={styles.overview}>
                <RichText data={brand.overview} />
              </section>
            )}
            <section className="mod" aria-labelledby="hotels-h">
              <div className="mod-head">
                <h2 id="hotels-h">{brand.name} hotels</h2>
                <Link href={filterHref}>Filter and sort</Link>
              </div>
              {hotels.docs.length > 0 ? (
                <>
                  <HotelTable hotels={hotels.docs} extras={rows} caption={`${brand.name} hotels`} columns={{ place: true }} />
                  <HotelTableNote />
                </>
              ) : (
                <p className="empty">No published hotels under this brand yet.</p>
              )}
              <PageNumbers page={hotels.page ?? 1} totalPages={hotels.totalPages} href={(p) => href({ region, page: p })} />
            </section>
          </div>

          <BrowseSide>
            <SideReviews
              id="reviews-h"
              title={`Our ${brand.name} reviews`}
              reviews={reviews.docs.map((r) => {
                const hotel = rel<Hotel>(r.hotel)
                return { slug: r.slug, title: r.title, score: r.totals?.overall ?? null, stayDate: r.stayDate, verdict: r.shortVerdict, place: rel<Destination>(hotel?.destination)?.name ?? null, photo: reviewPhoto(r, hotel) }
              })}
            />
            {program && <SideLinks id="brands-h" title={`More ${program.name} brands`} link={{ href: `/programs/${program.slug}#brands`, label: 'All brands' }} rows={siblings.map((b) => ({ href: `/brands/${b.slug}`, name: b.name }))} />}
            <StayBox id="stay-h" title={stayQuestion(brand.name)} />
          </BrowseSide>
        </div>
      </main>
    </>
  )
}
