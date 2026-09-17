import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { rel } from '@/lib/format'
import { accessLine, getLounge, loungeReaderData } from '@/lib/lounges'
import { MIN_STAYS } from '@/lib/readerData'
import type { Destination, Hotel, Program, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

const SERVICE: Record<string, string> = { breakfast: 'Breakfast', 'afternoon-tea': 'Afternoon tea', evening: 'Evening cocktails and canapés', 'all-day': 'All-day snacks and drinks' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lounge = await getLounge((await params).slug)
  if (!lounge) return {}
  const hotel = rel<Hotel>(lounge.hotel)
  return { title: `${lounge.name}${hotel ? `, ${hotel.name}` : ''}`, description: `Who gets in, hours, what is served, and whether it is worth a club room. ${accessLine(lounge)}.` }
}

export default async function LoungePage({ params }: Props) {
  const lounge = await getLounge((await params).slug)
  if (!lounge) notFound()
  const hotel = rel<Hotel>(lounge.hotel)
  const program = hotel ? rel<Program>(hotel.program) : null
  const destination = hotel ? rel<Destination>(hotel.destination) : null
  const reader = await loungeReaderData(lounge.id)
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
              <span className={styles.scoreBig}>{reader.data?.score != null ? reader.data.score.toFixed(1) : '–'}</span>
              <span className={styles.scoreNote}>
                {reader.data ? `Out of 10, from ${reader.data.stays} rated stays.` : `${reader.count} rated ${reader.count === 1 ? 'stay' : 'stays'} so far. Scores appear at ${MIN_STAYS}.`}
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
                    <div className={styles.n}>{reader.data.accessRate != null ? `${reader.data.accessRate}%` : '–'}</div>
                    <div className={styles.l}>Access honoured</div>
                  </div>
                  <div>
                    <div className={styles.n}>{reader.data.score?.toFixed(1) ?? '–'}</div>
                    <div className={styles.l}>Score out of 10</div>
                  </div>
                  <div>
                    <div className={styles.n}>{reader.data.worthItRate != null ? `${reader.data.worthItRate}%` : '–'}</div>
                    <div className={styles.l}>Say it is worth a club room</div>
                  </div>
                </div>
                <div className="panel-foot">From {reader.data.stays} reader stays that used the lounge. Reported by readers, checked before counting.</div>
              </>
            ) : (
              <p className={styles.waiting}>
                {reader.count === 0 ? 'No reader stays yet. ' : `${reader.count} rated ${reader.count === 1 ? 'stay' : 'stays'} so far. `}Numbers appear once {MIN_STAYS} stays have been checked.
                {hotel && (
                  <>
                    {' '}
                    <Link href={`/hotels/${hotel.slug}#reader-h`}>Add yours on the hotel page.</Link>
                  </>
                )}
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
    </>
  )
}
