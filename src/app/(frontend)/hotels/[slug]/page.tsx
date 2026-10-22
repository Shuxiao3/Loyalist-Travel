import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Where } from 'payload'
import type { ReactNode } from 'react'

import { HotelStayForm } from '@/components/HotelStayForm'
import { ReaderPanel } from '@/components/ReaderPanel'
import { SourcedPanel, SourcedSummary } from '@/components/SourcedPanel'
import { ViewBeacon } from '@/components/ViewBeacon'
import { rel, score, shortDate } from '@/lib/format'
import { getHotelSnapshots } from '@/lib/hotelSnapshot'
import { accessLine, getLoungesForHotel, loungeReaderData, servicesLine } from '@/lib/lounges'
import { hotelPhoto, loungePhoto, programLogo } from '@/lib/photos'
import { getHotel, getPayloadClient, getReviewsForHotel, topTierOf } from '@/lib/queries'
import { hotelReaderData, latestStays, MIN_STAYS } from '@/lib/readerData'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { hotelSourcedData } from '@/lib/sourcedData'
import { MIN_RATED_REPORTS } from '@/lib/upgradeRanking'
import type { Amenity, Brand, Destination, Hotel, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const hotel = await getHotel(slug)
  if (!hotel) return {}
  const destination = rel<Destination>(hotel.destination)
  const program = rel<Program>(hotel.program)
  const brand = rel<Brand>(hotel.brand)
  const where = destination ? ` in ${destination.locationLabel ?? destination.name}` : ''
  const elites = program ? `${program.name} elites` : 'elite members'
  const description = hotel.reviewStatus === 'reviewed'
    ? `${hotel.name}${where}: our scored review, plus reader-reported upgrade and suite odds for ${elites}.`
    : `${hotel.name}${where}${brand ? `, ${brand.name}` : ''}: reader-reported upgrade and suite odds for ${elites}. Add your stay in two minutes.`
  const seo = await getSeo()
  const vars = { Hotel: hotel.name, Destination: destination?.name, Location: destination?.locationLabel ?? destination?.name, Brand: brand?.name, Program: program?.name, Elite: await topTierOf(program), Elites: elites }
  const text = metaText(hotel.reviewStatus === 'reviewed' ? seo?.hotel : seo?.hotelUnreviewed, vars, { title: `${hotel.name}${destination ? `, ${destination.name}` : ''}`, description })
  return pageMeta({ ...text, path: `/hotels/${hotel.slug}`, image: hotelPhoto(hotel) })
}

// The resort fee as a figure ("$30", "a night") when it is a plain amount, else null and it
// stays a line in the hotel's details.
function resortFeeFigure(fee: string | null | undefined): { n: string; s?: string } | null {
  const m = fee?.trim().match(/^([$€£¥]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP))\s*(?:\/\s*|per\s+|a\s+)?(night|day)?$/i)
  if (!m) return null
  return { n: m[1].replace(/\s+/g, ''), s: m[2] ? `a ${m[2].toLowerCase()}` : undefined }
}

const joinList = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

// Up to this many other hotels, in the same destination, else of the same brand
const OTHERS = 8

type OtherHotel = { hotel: Hotel; program: Program | null; sub: string; odds: { rate: number; n: number } | null }

// Other hotels for the "More hotels" table: the destination's, or, when the hotel is the only
// one listed there, its brand's. Most stays reported first, then most viewed, then hotels of the
// same segment, then those with a neighborhood on record. The upgrade figure shows only once
// enough stays have said whether one came.
async function otherHotels(hotel: Hotel, destination: Destination | null, brand: Brand | null): Promise<{ by: 'destination' | 'brand'; rows: OtherHotel[] } | null> {
  const payload = await getPayloadClient()
  const find = async (where: Where) =>
    (
      await payload.find({
        collection: 'hotels',
        where: { and: [{ _status: { equals: 'published' } }, { id: { not_equals: hotel.id } }, where] },
        sort: ['-reportCount', '-views', 'name'],
        depth: 1,
        limit: 200,
        select: { name: true, slug: true, brand: true, program: true, destination: true, neighborhood: true, segment: true, clubLounge: true, reportCount: true, views: true },
        populate: { brands: { name: true }, programs: { name: true }, destinations: { name: true, locationLabel: true } },
      })
    ).docs as Hotel[]
  let by: 'destination' | 'brand' = 'destination'
  let docs = destination ? await find({ destination: { equals: destination.id } }) : []
  if (docs.length === 0 && brand) {
    by = 'brand'
    docs = await find({ brand: { equals: brand.id } })
  }
  if (docs.length === 0) return null
  const sameSegment = (h: Hotel) => (hotel.segment && h.segment === hotel.segment ? 1 : 0)
  const described = (h: Hotel) => (h.neighborhood ? 1 : 0)
  docs.sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0) || (b.views ?? 0) - (a.views ?? 0) || sameSegment(b) - sameSegment(a) || described(b) - described(a) || a.name.localeCompare(b.name))
  const picked = docs.slice(0, OTHERS)
  const snapshots = await getHotelSnapshots(picked.map((h) => h.id))
  const rows = picked.map((h) => {
    const b = rel<Brand>(h.brand)
    const d = rel<Destination>(h.destination)
    const snap = snapshots[h.id]
    // under "More Alila hotels" every row is an Alila, so the line is where it is
    const parts = by === 'brand' ? [d?.locationLabel ?? d?.name] : [b?.name, h.neighborhood, h.clubLounge === 'yes' ? 'Club lounge' : null]
    return {
      hotel: h,
      program: rel<Program>(h.program),
      sub: parts.filter(Boolean).join(' · '),
      odds: snap && snap.upgradeRate != null && snap.rated >= MIN_RATED_REPORTS ? { rate: snap.upgradeRate, n: snap.rated } : null,
    }
  })
  return { by, rows }
}

// A hotel page (mockups: hotel.html, a hotel without a review; hotel-reviewed.html; hotel-empty.html,
// no stays yet; hotel-breakdown.html, the window open). A navy band with the photo, the name, the
// figures (aggregated stay data, else the hotel's own: rooms, opening, resort fee); then the review
// as one compact strip when there is one, reader odds once readers have added enough stays, the
// hotel's details, its club lounge and other hotels nearby; the add-your-stay form and the program,
// brand and city beside them. The individual reported stays and the rates by status sit in the
// breakdown window.
export default async function HotelPage({ params }: Props) {
  const { slug } = await params
  const hotel = await getHotel(slug)
  if (!hotel) notFound()

  const brand = rel<Brand>(hotel.brand)
  const program = rel<Program>(hotel.program)
  const destination = rel<Destination>(hotel.destination)
  const photo = hotelPhoto(hotel)
  const logo = programLogo(program)
  const amenities = (hotel.amenities ?? []).map((a) => rel<Amenity>(a)).filter((a): a is Amenity => Boolean(a))
  const payload = await getPayloadClient()
  const [reviewsRes, readerData, tiersRes, lounges, recentStays, sourced, others] = await Promise.all([
    getReviewsForHotel(hotel.id),
    hotelReaderData(hotel.id),
    program ? payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 20, depth: 0 }) : Promise.resolve(null),
    getLoungesForHotel(hotel.id),
    latestStays(hotel.id),
    hotelSourcedData(hotel.id),
    otherHotels(hotel, destination, brand),
  ])
  const tiers = (tiersRes?.docs ?? []).map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))
  const loungeRows = await Promise.all(lounges.map(async (l) => ({ lounge: l, data: (await loungeReaderData(l.id)).data ?? null, photo: loungePhoto({ ...l, hotel: null }) })))
  const latest = reviewsRes.docs[0]
  const place = destination?.locationLabel ?? destination?.name

  // The band's figures: the aggregated stay data when there is some, else the hotel's own
  // figures (which then stay out of the details below)
  const fee = resortFeeFigure(hotel.resortFee)
  const renovated = hotel.renovationYear && hotel.renovationYear !== hotel.openingYear ? hotel.renovationYear : null
  const hotelFigs = sourced.data
    ? []
    : [
        hotel.numberOfRooms ? { key: 'rooms', n: hotel.numberOfRooms.toLocaleString('en-US'), l: 'Rooms' } : null,
        hotel.openingYear ? { key: 'opened', n: String(hotel.openingYear), l: 'Opened', s: renovated ? `renovated ${renovated}` : undefined } : null,
        fee ? { key: 'fee', n: fee.n, l: 'Resort fee', s: fee.s } : null,
      ].filter((f): f is { key: string; n: string; l: string; s?: string } => Boolean(f))
  const inBand = new Set(hotelFigs.map((f) => f.key))

  type Row = { k: string; v: ReactNode }
  const left: Row[] = [
    { k: 'Address', v: hotel.streetAddress || place },
    { k: 'Neighborhood', v: hotel.neighborhood },
    { k: 'Phone', v: hotel.phone },
    { k: 'Check-in', v: hotel.checkInTime },
    { k: 'Checkout', v: hotel.checkOutTime },
    // with a lounge on record, the Club lounge section says it
    { k: 'Club lounge', v: loungeRows.length === 0 ? (hotel.clubLounge === 'yes' ? 'Yes' : hotel.clubLounge === 'no' ? 'No' : null) : null },
  ]
  const right: Row[] = [
    { k: 'Points', v: hotel.pointsEligible === false ? 'Not bookable on points' : 'Bookable on points' },
    {
      k: 'Brand',
      v: brand ? (
        <Link className={styles.kvA} href={`/brands/${brand.slug}`}>
          {brand.name}
        </Link>
      ) : null,
    },
    {
      k: 'Program',
      v: program ? (
        logo ? (
          <Link className="kv-logo-a" href={`/programs/${program.slug}`}>
            <img className="kv-logo" src={logo} alt={program.name} />
          </Link>
        ) : (
          <Link className={styles.kvA} href={`/programs/${program.slug}`}>
            {program.name}
          </Link>
        )
      ) : null,
    },
    { k: 'Rooms', v: !inBand.has('rooms') && hotel.numberOfRooms ? hotel.numberOfRooms.toLocaleString('en-US') : null },
    { k: 'Opened', v: !inBand.has('opened') && hotel.openingYear ? [hotel.openingYear, renovated ? `renovated ${renovated}` : null].filter(Boolean).join(', ') : null },
    { k: 'Renovated', v: !hotel.openingYear && renovated ? String(renovated) : null },
    { k: 'Resort fee', v: !inBand.has('fee') ? hotel.resortFee : null },
    { k: 'Pet fee', v: hotel.petFee },
  ]
  // one list in this order, split into two columns of (nearly) equal length
  const details = [...left, ...right].filter((r) => r.v)
  const half = Math.ceil(details.length / 2)
  const kv = (list: Row[]) => (
    <dl className="kv">
      {list.map((r) => (
        <div key={r.k}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  )

  const noStays = !sourced.data && readerData.count === 0
  const addIntro = noStays
    ? `No stays reported for ${hotel.name} yet, so yours would be the first. Two minutes, dropdowns only.`
    : readerData.all
      ? `Two minutes, dropdowns only. Each stay is checked, then joins the reader odds for ${hotel.name}.`
      : `Two minutes, dropdowns only. Reader odds for ${hotel.name} appear once ${MIN_STAYS} stays have been checked.`

  const contextTitle = joinList([program ? 'program' : null, brand ? 'brand' : null, destination ? 'city' : null].filter((x): x is string => Boolean(x)))
  const destinationHref = destination ? `/destinations/${destination.slug}` : null
  // its own line, else where it is ("California, United States.")
  const region = destination ? [destination.stateOrRegion, destination.country].filter((x) => x && x !== destination.name).join(', ') : ''
  const destinationLine = destination?.shortDescription?.trim() || (region ? `${region}.` : null)
  const reviewScore = latest ? score(latest.totals?.overall) : null
  const reviewDate = latest ? shortDate(latest.publishedDate) : null

  return (
    <>
      <ViewBeacon hotel={hotel.id} />
      <section className={`band page-band ${styles.band}`}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/hotels">Hotels</Link>
            <span className="sep">/</span>
            {program && (
              <>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                <span className="sep">/</span>
              </>
            )}
            {destination && destinationHref && (
              <>
                <Link href={destinationHref}>{destination.name}</Link>
                <span className="sep">/</span>
              </>
            )}
            <span aria-current="page">{hotel.name}</span>
          </nav>
          <div className={`pb-row ${styles.hbRow} ${photo ? '' : styles.noPhoto}`}>
            {/* a background, so a photo that fails to load leaves the plain box, not a broken image */}
            {photo && <div className={`img-box ${styles.hbPhoto} ${styles.cover}`} role="img" aria-label={hotel.name} style={{ backgroundImage: `url(${photo})` }} />}
            <div className="pb-title">
              <h1>{hotel.name}</h1>
              {(brand || program || place) && <p className="pb-dek">{[brand?.name, program?.name, place].filter(Boolean).join(' · ')}</p>}
              {hotel.streetAddress && <p className="pb-meta">{[hotel.streetAddress, hotel.neighborhood].filter(Boolean).join(' · ')}</p>}
              <p className="pb-actions">
                {hotel.bookingLink && (
                  <a className="btn btn-light" href={hotel.bookingLink} rel="noopener" target="_blank">
                    Book direct
                  </a>
                )}
                <a href="#add">Add your stay</a>
              </p>
            </div>
            {sourced.data ? (
              <SourcedSummary data={sourced.data} />
            ) : (
              hotelFigs.length > 0 && (
                <div className="figs figs-sm">
                  {hotelFigs.map((f) => (
                    <div className="fig" key={f.key}>
                      <p className="fig-n">{f.n}</p>
                      <p className="fig-l">{f.l}</p>
                      {f.s && <p className="fig-s">{f.s}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <main className="wrap main">
        <div className={`grid-side ${styles.grid}`}>
          <div className={styles.col}>
            {latest && (
              <div className={`review-strip ${styles.review}`}>
                <Link className="score" href={`/reviews/${latest.slug}`} aria-label={`Score ${reviewScore} out of 100`}>
                  <b>{reviewScore}</b>
                  <span>of 100</span>
                </Link>
                <div>
                  <p className="rs-label">
                    <b>Our review</b>
                    <span className={styles.rsBy}> · By {SITE.author}</span>
                    {reviewDate && (
                      <>
                        {' · '}
                        <span className={styles.nw}>{reviewDate}</span>
                      </>
                    )}
                  </p>
                  <p className="rs-verdict">
                    {latest.shortVerdict || latest.title}{' '}
                    <Link className={styles.rsLinkIn} href={`/reviews/${latest.slug}`}>
                      Read the review
                    </Link>
                  </p>
                </div>
                <Link className="rs-link" href={`/reviews/${latest.slug}`}>
                  Read the review
                </Link>
              </div>
            )}

            <ReaderPanel data={readerData} latest={recentStays} />

            <section className="mod" aria-labelledby="hotel-h">
              <div className="mod-head">
                <h2 id="hotel-h">The hotel</h2>
              </div>
              <div className={`cols2 ${styles.kvPair}`}>
                {kv(details.slice(0, half))}
                {kv(details.slice(half))}
              </div>
              {amenities.length > 0 && (
                <dl className={`kv ${styles.kvWide}`}>
                  <div>
                    <dt>Amenities</dt>
                    <dd>{amenities.map((a) => a.name).join(', ')}</dd>
                  </div>
                </dl>
              )}
            </section>

            {loungeRows.length > 0 && (
              <section className="mod" aria-labelledby="lounge-h">
                <div className="mod-head">
                  <h2 id="lounge-h">{loungeRows.length > 1 ? 'Club lounges' : 'Club lounge'}</h2>
                  <Link href="/lounges">All lounges</Link>
                </div>
                {loungeRows.map(({ lounge, data, photo: lp }) => {
                  const services = servicesLine(lounge)
                  const href = `/lounges/${lounge.slug}`
                  return (
                    <div className={`${styles.lounge} ${lp ? '' : styles.loungeNoPh}`} key={lounge.id}>
                      {lp && <Link className={`img-box ${styles.loungePh} ${styles.cover}`} href={href} tabIndex={-1} aria-hidden="true" style={{ backgroundImage: `url(${lp})` }} />}
                      <h3>
                        <Link href={href}>{lounge.name}</Link>
                      </h3>
                      <dl className="kv">
                        <div>
                          <dt>Access</dt>
                          <dd>{accessLine(lounge)}</dd>
                        </div>
                        <div>
                          <dt>Hours and service</dt>
                          {services ? <dd>{services}</dd> : <dd className="muted">Not recorded yet</dd>}
                        </div>
                        <div>
                          <dt>Reader score</dt>
                          {data?.score != null ? (
                            <dd>
                              <span className="score-inline">
                                {data.score.toFixed(1)}
                                <small>/5</small>
                              </span>{' '}
                              from {data.stays} ratings
                            </dd>
                          ) : (
                            <dd className="muted">Not yet rated. Scores appear at {MIN_STAYS} ratings.</dd>
                          )}
                        </div>
                      </dl>
                      <p className={styles.loungeAct}>
                        <Link className="link" href={`${href}#rate`}>
                          Rate this lounge
                        </Link>
                      </p>
                    </div>
                  )
                })}
              </section>
            )}

            {others && (
              <section className={`mod ${styles.mOthers}`} aria-labelledby="others-h">
                <div className="mod-head">
                  {others.by === 'brand' && brand ? (
                    <>
                      <h2 id="others-h">More {brand.name} hotels</h2>
                      <Link href={`/brands/${brand.slug}`}>All {brand.name} hotels</Link>
                    </>
                  ) : (
                    destination &&
                    destinationHref && (
                      <>
                        <h2 id="others-h">More hotels in {destination.name}</h2>
                        <Link href={destinationHref}>
                          All hotels<span className={styles.lgInline}> in {destination.name}</span>
                        </Link>
                      </>
                    )
                  )}
                </div>
                <table className={`table ${styles.others}`}>
                  <thead>
                    <tr>
                      <th>Hotel</th>
                      <th className={styles.lgCol}>Program</th>
                      <th className="r">Got an upgrade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.rows.map((o) => (
                      <tr key={o.hotel.id}>
                        <th scope="row">
                          <Link className="hn" href={`/hotels/${o.hotel.slug}`}>
                            {o.hotel.name}
                          </Link>
                          <span className="sub-b">
                            {o.sub}
                            {/* on phones the program joins the line, unless every row shares it (the brand's list) */}
                            {o.program && others.by === 'destination' && <span className={styles.smOnly}>{o.sub ? ' · ' : ''}{o.program.name}</span>}
                          </span>
                        </th>
                        <td className={styles.lgCol}>{o.program?.name}</td>
                        <td className="r">
                          {o.odds ? (
                            <>
                              <span className="pct">{o.odds.rate}%</span> <span className="n">of {o.odds.n}</span>
                            </>
                          ) : (
                            <span className="na" aria-label="Not enough stays yet">
                              –
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mod-note">
                  {others.by === 'brand' && destination ? `${hotel.name} is the only hotel listed in ${destination.name}. ` : ''}
                  Got an upgrade shows once {MIN_RATED_REPORTS} stays have said whether one came; until then, a dash.
                </p>
              </section>
            )}
          </div>

          <aside className={styles.side}>
            <section className={`box ${styles.addBox}`} id="add" aria-labelledby="add-h">
              <h2 id="add-h">Stayed here? Add your stay</h2>
              <p>{addIntro}</p>
              {program && tiers.length > 0 ? (
                <HotelStayForm hotel={{ id: hotel.id, name: hotel.name }} programName={program.name} tiers={tiers} />
              ) : (
                <p className="help">This program&rsquo;s tiers are not set up yet.</p>
              )}
            </section>

            {contextTitle && (
              <section className="mod" aria-labelledby="ctx-h">
                <div className="mod-head">
                  <h2 id="ctx-h">{contextTitle.charAt(0).toUpperCase() + contextTitle.slice(1)}</h2>
                </div>
                {program && (
                  <div className={styles.ctx}>
                    <h3>
                      {logo ? (
                        <Link className={styles.ctxHead} href={`/programs/${program.slug}`}>
                          <img className={styles.ctxLogo} src={logo} alt={program.name} />
                        </Link>
                      ) : (
                        <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                      )}
                    </h3>
                  </div>
                )}
                {brand && (
                  <div className={styles.ctx}>
                    <h3>
                      <Link href={`/brands/${brand.slug}`}>{brand.name}</Link>
                    </h3>
                    {brand.shortDescription && <p>{brand.shortDescription}</p>}
                    <p className={styles.ctxLinks}>
                      <Link href={`/brands/${brand.slug}`}>Hotels</Link>
                    </p>
                  </div>
                )}
                {destination && destinationHref && (
                  <div className={styles.ctx}>
                    <h3>
                      <Link href={destinationHref}>{destination.name}</Link>
                    </h3>
                    {destinationLine && <p>{destinationLine}</p>}
                    <p className={styles.ctxLinks}>
                      <Link href={destinationHref}>Hotels</Link>
                      {program && <Link href={`${destinationHref}?program=${program.slug}`}>{program.name} hotels</Link>}
                    </p>
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>

      <SourcedPanel data={sourced} hotelName={hotel.name} />
    </>
  )
}
