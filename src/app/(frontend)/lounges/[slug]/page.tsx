import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LOUNGE_FACTORS } from '@/lib/stayOptions'
import { Comments } from '@/components/Comments'
import { RichText } from '@/components/RichText'
import { ScoreBar } from '@/components/ScoreBar'
import { rel } from '@/lib/format'
import { accessLine, getLounge, getLoungeRatings, loungeReaderData } from '@/lib/lounges'
import { LoungeRatingForm } from '@/components/LoungeRatingForm'
import { getPayloadClient } from '@/lib/payload'
import { MIN_STAYS } from '@/lib/readerData'
import type { Destination, Hotel, Program, Reader, StatusLevel } from '@/payload-types'

import { pageMeta } from '@/lib/seo'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

const ACCESS: Record<string, string> = { given: 'Access given', declined: 'Access declined', 'not-used': 'Did not use it' }
const WORTH: Record<string, string> = { yes: 'Worth a club room', no: 'Not worth a club room' }

const SERVICE: Record<string, string> = { breakfast: 'Breakfast', 'afternoon-tea': 'Afternoon tea', evening: 'Evening cocktails and canapés', 'all-day': 'All-day snacks and drinks' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lounge = await getLounge((await params).slug)
  if (!lounge) return {}
  const hotel = rel<Hotel>(lounge.hotel)
  return pageMeta({ title: `${lounge.name}${hotel ? `, ${hotel.name}` : ''}`, description: `Who gets in, hours, what is served, and whether it is worth a club room. ${accessLine(lounge)}.`, path: `/lounges/${lounge.slug}`, image: lounge.externalImageUrl ?? hotel?.externalImageUrl })
}

export default async function LoungePage({ params }: Props) {
  const lounge = await getLounge((await params).slug)
  if (!lounge) notFound()
  const hotel = rel<Hotel>(lounge.hotel)
  const program = hotel ? rel<Program>(hotel.program) : null
  const destination = hotel ? rel<Destination>(hotel.destination) : null
  const payload = await getPayloadClient()
  const [reader, stays, tiersRes] = await Promise.all([
    loungeReaderData(lounge.id),
    getLoungeRatings(lounge.id),
    program ? payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 20, depth: 0 }) : Promise.resolve(null),
  ])
  const programTiers = (tiersRes?.docs ?? []).map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))
  const tiers = (lounge.access?.tiers ?? []).map((t) => rel<StatusLevel>(t)).filter((t): t is StatusLevel => Boolean(t))
  const image = lounge.externalImageUrl ?? hotel?.externalImageUrl

  const facts = [
    { label: 'Where', value: lounge.location },
    ...(lounge.services ?? []).map((s) => ({ label: SERVICE[s.service] ?? s.service, value: [s.from, s.to].filter(Boolean).join(' – ') || 'Served' })),
    { label: 'Dress code', value: lounge.dressCode },
    { label: 'Paid access', value: lounge.access?.paid },
  ].filter((f) => f.value)

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <ol className="crumbs" aria-label="Breadcrumb">
            <li>
              <Link href="/lounges">Lounges</Link>
            </li>
            {program && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                </li>
              </>
            )}
            {destination && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/destinations/${destination.slug}`}>{destination.name}</Link>
                </li>
              </>
            )}
          </ol>
          <div className={styles.heroGrid}>
            <div>
              <span className="eyebrow">{hotel?.name ?? 'Lounge'}</span>
              <h1 className={styles.h1}>{lounge.name}</h1>
              <p className={`sub ${styles.sub}`}>{accessLine(lounge)}.</p>
              <div className="chips">
                {tiers.map((t) => (
                  <span className="chip" key={t.id}>
                    {t.shortName ?? t.name}
                  </span>
                ))}
                {lounge.access?.clubRooms && <span className="chip">Club rooms</span>}
                {lounge.access?.paid && <span className="chip">Paid access</span>}
              </div>
            </div>
            <div className={styles.scorePanel}>
              <span className={`label ${styles.scoreLabel}`}>Reader score</span>
              <span className={styles.scoreBig}>
                {reader.data?.score != null ? reader.data.score.toFixed(1) : '–'}
                <span className={styles.scoreOf}>/5</span>
              </span>
              <span className={styles.scoreNote}>
                {reader.data ? `Overall, from ${reader.data.stays} ratings.` : `${reader.count} ${reader.count === 1 ? 'rating' : 'ratings'} so far. Scores appear at ${MIN_STAYS}.`}
              </span>
            </div>
          </div>
          <div className={`byline ${styles.byline}`}>
            {hotel && (
              <Link className="ghost" href={`/hotels/${hotel.slug}`}>
                The hotel
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="hero-img" role="img" aria-label={lounge.name} style={image ? { backgroundImage: `url(${image}), var(--img-a)` } : undefined} />

      {facts.length > 0 && (
        <section className={`section ${styles.facts}`} aria-labelledby="facts-h">
          <div className="wrap">
            <span className="eyebrow on-light" id="facts-h">
              As printed
            </span>
            <div className="grid-cells">
              {facts.map((f) => (
                <div className="cell" key={f.label}>
                  <span className="label">{f.label}</span>
                  <span className="val">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.body}`}>
        <div className={`wrap ${styles.bodyGrid}`}>
          <section className="panel" aria-labelledby="reader-h">
            <span className="eyebrow" id="reader-h">
              Reader data
            </span>
            {reader.data ? (
              <>
                <div className={styles.figures}>
                  <div>
                    <div className={styles.n}>{reader.data.score?.toFixed(1) ?? '–'}</div>
                    <div className={styles.l}>Overall, out of 5</div>
                  </div>
                  <div>
                    <div className={styles.n}>{reader.data.worthItRate != null ? `${reader.data.worthItRate}%` : '–'}</div>
                    <div className={styles.l}>Say it is worth a club room</div>
                  </div>
                </div>
                <div className={styles.factors}>
                  {LOUNGE_FACTORS.filter((f) => f.name !== 'overall').map((f) => (
                    <ScoreBar key={f.name} label={f.label} value={reader.data?.factors[f.name]} tone="dark" />
                  ))}
                </div>
                <div className="panel-foot">From {reader.data.stays} readers who used the lounge. Checked before counting.</div>
              </>
            ) : (
              <p className={styles.waiting}>
                {reader.count === 0 ? 'No ratings yet. ' : `${reader.count} ${reader.count === 1 ? 'rating' : 'ratings'} so far. `}Numbers appear once {MIN_STAYS} have been checked.
                {' '}
                <a href="#rate-h">Rate it below.</a>
              </p>
            )}
          </section>
          <div>
            {lounge.note ? (
              <>
                <span className={`eyebrow on-light ${styles.noteEyebrow}`}>The take</span>
                <RichText data={lounge.note} />
              </>
            ) : (
              <p className={styles.waiting2}>No editorial note yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className={`section ${styles.rate}`} aria-labelledby="rate-h">
        <div className={`wrap ${styles.rateGrid}`}>
          <div>
            <span className="eyebrow on-light">Rate this lounge</span>
            <h2 id="rate-h" className={styles.rateH2}>
              Sat in {lounge.name}?
            </h2>
            <p className={styles.rateP}>Food, drink, space and service out of five, an overall mark, and whether it was worth a club room. Two minutes. Read before it counts.</p>
          </div>
          <div className={`panel ${styles.ratePanel}`}>
            {program && programTiers.length > 0 ? <LoungeRatingForm lounge={{ id: lounge.id, name: lounge.name }} programName={program.name} tiers={programTiers} /> : <p className={styles.waiting}>This program's tiers are not set up yet.</p>}
          </div>
        </div>
      </section>

      {stays.length > 0 && (
        <section className={`section ${styles.stays}`} aria-labelledby="stays-h">
          <div className="wrap">
            <div className={styles.staysHead}>
              <div>
                <span className="eyebrow on-light">Reader ratings</span>
                <h2 id="stays-h" className={styles.staysH2}>
                  {stays.length} {stays.length === 1 ? 'rating' : 'ratings'} as reported
                </h2>
              </div>
              <a className="ghost" href="#rate-h">
                Add yours
              </a>
            </div>
            <ol className={styles.stayList}>
              {stays.map((s) => {
                const tier = rel<StatusLevel>(s.statusHeld)
                const who = rel<Reader>(s.reader)
                const a = s
                return (
                  <li className={styles.stay} key={s.id}>
                    <div className={styles.stayWho}>
                      <span className={styles.stayTier}>{who?.displayName ?? 'Anonymous reader'}</span>
                      <span className={styles.stayYear}>
                        {tier?.shortName ?? tier?.name ?? 'Member'} · Stayed {s.stayYear}
                      </span>
                    </div>
                    <div className={styles.stayWhat}>
                      {a.worthIt ? <span>{WORTH[a.worthIt]}</span> : <span>{ACCESS[a.access ?? ''] ?? 'No score given'}</span>}
                    </div>
                    <div className={styles.stayScore}>
                      {typeof a.overall === 'number' ? (
                        <>
                          <span className={styles.stayN}>{a.overall}</span>
                          <span className={styles.stayOf}>/5</span>
                        </>
                      ) : (
                        <span className={styles.stayOf}>Not scored</span>
                      )}
                    </div>
                    {typeof a.overall === 'number' && (
                      <dl className={styles.stayFactors}>
                        {LOUNGE_FACTORS.filter((f) => f.name !== 'overall').map((f) => (
                          <div key={f.name}>
                            <dt>{f.label}</dt>
                            <dd>
                              <span className={styles.mini} aria-hidden="true">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <i key={n} className={n <= (a[f.name] ?? 0) ? styles.miniOn : ''} />
                                ))}
                              </span>
                              {a[f.name] ?? '–'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {a.comment?.trim() && <p className={styles.stayComment}>“{a.comment.trim()}”</p>}
                  </li>
                )
              })}
            </ol>
            <p className={styles.staysNote}>Every stay and every comment is read before it is posted. No names, and nothing that identifies the reader.</p>
          </div>
        </section>
      )}

      <Comments kind="lounges" id={lounge.id} />
    </>
  )
}
