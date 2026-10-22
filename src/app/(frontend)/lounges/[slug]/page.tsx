import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'

import { LoungeRatingForm } from '@/components/LoungeRatingForm'
import { PlainComments } from '@/components/PlainComments'
import { RichText } from '@/components/RichText'
import { rel } from '@/lib/format'
import { accessLine, getLounge, getLoungeRatings, loungeReaderData, relatedLounges } from '@/lib/lounges'
import { getPayloadClient } from '@/lib/payload'
import { hotelPhoto, loungePhoto, programLogo } from '@/lib/photos'
import { topTierOf } from '@/lib/queries'
import { MIN_STAYS } from '@/lib/readerData'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { LOUNGE_FACTORS } from '@/lib/stayOptions'
import type { Brand, Destination, Hotel, Program, Reader, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

const WORTH: Record<string, string> = { yes: 'Worth a club room', no: 'Not worth a club room' }
// an older rating that says whether access was given, in place of worth a club room
const ACCESS: Record<string, string> = { given: 'Access given', declined: 'Access declined', 'not-used': 'Did not use it' }
const SERVICE: Record<string, string> = { breakfast: 'Breakfast', 'afternoon-tea': 'Afternoon tea', evening: 'Evening cocktails and canapés', 'all-day': 'All-day snacks and drinks' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lounge = await getLounge((await params).slug)
  if (!lounge) return {}
  const hotel = rel<Hotel>(lounge.hotel)
  const seo = await getSeo()
  const text = metaText(seo?.lounge, { Lounge: lounge.name, Hotel: hotel?.name, Access: accessLine(lounge), Program: rel<Program>(hotel?.program)?.name, Elite: await topTierOf(rel<Program>(hotel?.program)) }, { title: `${lounge.name}${hotel ? `, ${hotel.name}` : ''}`, description: `Who gets in, hours, what is served, and whether it is worth a club room. ${accessLine(lounge)}.` })
  return pageMeta({ ...text, path: `/lounges/${lounge.slug}`, image: loungePhoto(lounge, hotel) })
}

// "paid access, location and dress code"
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  )
}

// A lounge (mockup: lounge.html). The band carries the breadcrumb, the photo, the lounge and its
// hotel, the program and place, who gets in, and the two actions. Main column: who gets in, tier
// by tier, with what else is on record; the reader ratings (one line until enough are checked);
// the editorial take when there is one; the hotel; comments. Side column: the rating form in its
// box, and the other hotels with a lounge of the same name in the country.
export default async function LoungePage({ params }: Props) {
  const lounge = await getLounge((await params).slug)
  if (!lounge) notFound()
  const hotel = rel<Hotel>(lounge.hotel)
  const program = hotel ? rel<Program>(hotel.program) : null
  const destination = hotel ? rel<Destination>(hotel.destination) : null
  const brand = hotel ? rel<Brand>(hotel.brand) : null
  const payload = await getPayloadClient()
  const [reader, stays, tiersRes, related] = await Promise.all([
    loungeReaderData(lounge.id),
    getLoungeRatings(lounge.id),
    program ? payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 20, depth: 0 }) : Promise.resolve(null),
    relatedLounges(lounge),
  ])
  const programTiers = tiersRes?.docs ?? []
  const formTiers = programTiers.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))
  const accessIds = new Set((lounge.access?.tiers ?? []).map((t) => (typeof t === 'object' ? t.id : t)))
  const image = loungePhoto(lounge, hotel)
  // The lounge's photo is often its hotel's own; the page shows a photo once, in the band
  const hotelPhotoUrl = hotelPhoto(hotel)
  const hotelImage = hotelPhotoUrl && hotelPhotoUrl !== image ? hotelPhotoUrl : null
  const place = destination ? destination.locationLabel?.trim() || destination.name : null
  const title = `${lounge.name}${hotel ? `, ${hotel.name}` : ''}`
  const hotelHref = hotel ? `/hotels/${hotel.slug}` : null

  // Who gets in, beside the tiers: club rooms, then what else is on record
  const services = lounge.services ?? []
  const accessRows: { k: string; v: string }[] = [
    lounge.access?.clubRooms ? { k: 'Club rooms', v: 'Guests booked in a club room get in, at any tier' } : null,
    lounge.access?.paid ? { k: 'Paid access', v: lounge.access.paid } : null,
    lounge.location ? { k: 'Location', v: lounge.location } : null,
    ...services.map((s) => ({ k: SERVICE[s.service] ?? s.service, v: [s.from, s.to].filter(Boolean).join(' to ') || 'Served' })),
    lounge.dressCode ? { k: 'Dress code', v: lounge.dressCode } : null,
  ].filter((r): r is { k: string; v: string } => Boolean(r))
  const missing = [
    lounge.access?.paid ? null : 'paid access',
    lounge.location ? null : 'location',
    services.some((s) => s.from || s.to) ? null : 'hours',
    services.length > 0 ? null : 'food',
    lounge.dressCode ? null : 'dress code',
  ].filter((m): m is string => Boolean(m))
  const missingLine = missing.length ? `${cap(joinList(missing))} ${missing.length === 1 ? 'is' : 'are'} not recorded yet.` : null

  // The hotel's details, in two columns
  const renovated = hotel?.renovationYear && hotel.renovationYear !== hotel.openingYear ? hotel.renovationYear : null
  const logo = programLogo(program)
  const hotelLeft: { k: string; v: ReactNode }[] = hotel
    ? [
        { k: 'Neighborhood', v: hotel.neighborhood },
        { k: 'Address', v: hotel.streetAddress },
        { k: 'Phone', v: hotel.phone },
        { k: 'Check-in', v: hotel.checkInTime },
        { k: 'Checkout', v: hotel.checkOutTime },
      ].filter((r) => r.v)
    : []
  const hotelRight: { k: string; v: ReactNode }[] = hotel
    ? [
        { k: 'Rooms', v: hotel.numberOfRooms ? hotel.numberOfRooms.toLocaleString('en-US') : null },
        { k: 'Opened', v: hotel.openingYear ? [hotel.openingYear, renovated ? `renovated ${renovated}` : null].filter(Boolean).join(', ') : renovated ? `Renovated ${renovated}` : null },
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="kv-logo" src={logo} alt={program.name} />
              </Link>
            ) : (
              <Link className={styles.kvA} href={`/programs/${program.slug}`}>
                {program.name}
              </Link>
            )
          ) : null,
        },
      ].filter((r) => r.v)
    : []
  const kv = (rows: { k: string; v: ReactNode }[], className?: string) => (
    <dl className={className ? `kv ${className}` : 'kv'}>
      {rows.map((r) => (
        <div key={r.k}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  )

  const othersTitle = related.sameName ? `More ${lounge.name}` : `More ${program?.name ?? ''} lounges`.replace(/\s+/g, ' ')

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/lounges">Lounges</Link>
            {program && (
              <>
                <span className="sep">/</span>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
              </>
            )}
            {destination && (
              <>
                <span className="sep">/</span>
                <Link href={`/destinations/${destination.slug}`}>{destination.name}</Link>
              </>
            )}
          </nav>
          <div className={`pb-row${image ? ` ${styles.bandRow}` : ''}`}>
            {image && <div className={styles.bandPhoto} role="img" aria-label={hotel && image === hotelPhotoUrl ? hotel.name : lounge.name} style={{ backgroundImage: `url(${image})` }} />}
            <div className="pb-title">
              <h1>{title}</h1>
              {(program || place) && (
                <p className="pb-dek">
                  {[program?.name, place]
                    .filter(Boolean)
                    .map((part, i) => (
                      <Fragment key={i}>
                        {i > 0 && '\u00a0· '}
                        <span className={styles.nw}>{part}</span>
                      </Fragment>
                    ))}
                </p>
              )}
              <p className="pb-meta">Who gets in: {accessLine(lounge)}</p>
              <p className={`pb-actions ${styles.actions}`}>
                <a className="btn btn-light" href="#rate">
                  Rate this lounge
                </a>
                {hotelHref && <Link href={hotelHref}>Hotel page</Link>}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="wrap main">
        <div className={`grid-side ${styles.grid}`}>
          <div className={styles.col}>
            <section className={`mod ${styles.access}`} aria-labelledby="access-h">
              <div className="mod-head">
                <h2 id="access-h">Who gets in</h2>
                <span className="aside">As printed</span>
              </div>
              <div className={programTiers.length > 0 ? styles.accessGrid : undefined}>
                {program && programTiers.length > 0 && (
                  <table className={`table ${styles.accTable}`}>
                    <thead>
                      <tr>
                        <th>{program.name} tier</th>
                        <th>To qualify</th>
                        <th className="r">Gets in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programTiers.map((t: StatusLevel) => {
                        const inByStatus = accessIds.has(t.id)
                        return (
                          <tr key={t.id} className={inByStatus ? styles.in : undefined}>
                            <th scope="row">{t.shortName ?? t.name}</th>
                            <td className={styles.n}>{t.nights ?? ''}</td>
                            <td className="r">
                              {inByStatus ? (
                                <span className={styles.yes}>
                                  <Check />
                                  By status
                                </span>
                              ) : (
                                <span className="na">{lounge.access?.clubRooms ? 'With a club room' : lounge.access?.paid ? 'Paid access' : 'No'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                <div>
                  {accessRows.length > 0 && kv(accessRows, styles.accessKv)}
                  {missingLine && <p className={`mod-note ${styles.notRecorded}`}>{missingLine}</p>}
                </div>
              </div>
            </section>

            <section className={`mod ${styles.ratings}`} aria-labelledby="ratings-h">
              <div className="mod-head">
                <h2 id="ratings-h">Reader ratings</h2>
                {reader.data && <span className="aside">Out of 5</span>}
              </div>
              {reader.data ? (
                <>
                  <ul className={`bars ${styles.bars}`}>
                    {LOUNGE_FACTORS.map((f) => {
                      const v = reader.data?.factors[f.name]
                      return (
                        <li key={f.name} className={f.name === 'overall' ? styles.overall : undefined}>
                          <span>{f.label}</span>
                          <span className="bar">
                            <i style={{ width: `${v != null ? (v / 5) * 100 : 0}%` }} />
                          </span>
                          <span className="v">
                            {v != null ? v.toFixed(1) : '–'}
                            <small>/5</small>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mod-note">
                    {reader.data.worthItRate != null ? `${reader.data.worthItRate}% say it is worth a club room. ` : ''}From {reader.data.stays} readers who used the lounge, each rating checked before it counts.
                  </p>
                </>
              ) : (
                <p className={styles.none}>
                  {reader.count === 0 ? 'No ratings yet.' : `${reader.count} ${reader.count === 1 ? 'rating' : 'ratings'} so far.`} Scores appear once {MIN_STAYS} are checked.{' '}
                  <a className="link" href="#rate">
                    Rate it
                  </a>
                </p>
              )}
              {stays.length > 0 && (
                <ol className={styles.stays} aria-label="Each rating">
                  {stays.map((s) => {
                    const tier = rel<StatusLevel>(s.statusHeld)
                    const who = rel<Reader>(s.reader)
                    return (
                      <li key={s.id}>
                        <p className={styles.stayWhen}>
                          <b>{who?.displayName ?? 'Reader'}</b> · {tier?.shortName ?? tier?.name ?? 'Member'} · Stayed {s.stayYear}
                        </p>
                        <p className={styles.stayFacts}>
                          {typeof s.overall === 'number' && (
                            <span>
                              Overall <b>{s.overall}</b>/5
                            </span>
                          )}
                          {LOUNGE_FACTORS.filter((f) => f.name !== 'overall' && typeof s[f.name] === 'number').map((f) => (
                            <span key={f.name}>
                              {f.label} <b>{s[f.name]}</b>
                            </span>
                          ))}
                          {s.worthIt && WORTH[s.worthIt] ? <span>{WORTH[s.worthIt]}</span> : s.access && ACCESS[s.access] ? <span>{ACCESS[s.access]}</span> : null}
                        </p>
                        {s.comment?.trim() && <p className={styles.stayComment}>{s.comment.trim()}</p>}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            {lounge.note && (
              <section className={`mod ${styles.take}`} aria-labelledby="take-h">
                <div className="mod-head">
                  <h2 id="take-h">Our take</h2>
                </div>
                <RichText data={lounge.note} className={`prose ${styles.takeProse}`} />
              </section>
            )}

            {hotel && hotelHref && (
              <section className={`mod ${styles.hotel}`} aria-labelledby="hotel-h">
                <div className="mod-head">
                  <h2 id="hotel-h">The hotel</h2>
                  <Link href={hotelHref}>Hotel page</Link>
                </div>
                <div className={`${styles.hotelRow}${hotelImage ? '' : ` ${styles.noPhoto}`}`}>
                  {hotelImage && <div className={styles.hotelPhoto} role="img" aria-label={hotel.name} style={{ backgroundImage: `url(${hotelImage})` }} />}
                  <div className={styles.hotelText}>
                    <h3>
                      <Link href={hotelHref}>{hotel.name}</Link>
                    </h3>
                    {hotel.heroSummary && <p className={styles.sum}>{hotel.heroSummary}</p>}
                  </div>
                </div>
                {(hotelLeft.length > 0 || hotelRight.length > 0) && (
                  <div className={`cols2 ${styles.hotelKv}`}>
                    {hotelLeft.length > 0 && kv(hotelLeft)}
                    {hotelRight.length > 0 && kv(hotelRight)}
                  </div>
                )}
              </section>
            )}

            <PlainComments kind="lounges" id={lounge.id} className={`mod ${styles.comments}`} />
          </div>

          <aside className={styles.side} aria-label={`More on ${lounge.name}`}>
            <section className={`box ${styles.rate}`} id="rate" aria-labelledby="rate-h">
              <h2 id="rate-h">Sat in {lounge.name}?</h2>
              <p>Food, drink, space and ambiance, and service out of five, an overall mark, and whether it was worth a club room. Two minutes.</p>
              {program && formTiers.length > 0 ? <LoungeRatingForm lounge={{ id: lounge.id, name: lounge.name }} programName={program.name} tiers={formTiers} /> : <p className="note">This program&rsquo;s tiers are not set up yet.</p>}
            </section>

            {related.rows.length > 0 && (
              <section className={`mod ${styles.others}`} aria-labelledby="others-h">
                <div className="mod-head">
                  <h2 id="others-h">{othersTitle}</h2>
                </div>
                <ol className={styles.sideList}>
                  {related.rows.map((r) => (
                    <li key={r.slug}>
                      <Link className="hn" href={`/lounges/${r.slug}`}>
                        {r.hotel}
                      </Link>
                      {r.place && <p className={styles.slMeta}>{r.place}</p>}
                    </li>
                  ))}
                </ol>
                {related.country && <p className="mod-note">{related.sameName ? `The other ${related.country} hotels with one.` : `The program's other lounges in ${related.country}.`}</p>}
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  )
}
