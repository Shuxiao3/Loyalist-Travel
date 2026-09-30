import type { HotelSourcedData } from '@/lib/sourcedData'
import { monthLabel, SOURCE_LABEL } from '@/lib/sourcedData'

import styles from './SourcedPanel.module.css'

const pct = (r: { value: number | null; n: number }) => (r.value == null ? '–' : `${r.value}%`)
const of = (r: { value: number | null; n: number }) => (r.n > 0 ? `of ${r.n}` : 'none said')

// The aggregated-data panel on a hotel page: stays members reported on
// forums, tallied, then each one in a line with a link to its post.
export function SourcedPanel({ data, hotelName }: { data: HotelSourcedData; hotelName: string }) {
  if (!data.data) {
    return (
      <section className={`panel ${styles.panel}`} aria-labelledby="sourced-h">
        <span className="eyebrow" id="sourced-h">
          Aggregated data
        </span>
        <p className={styles.intro}>Stays reported on FlyerTalk and Reddit, tallied here with a link to each source. Kept apart from reader submissions so the two never mix.</p>
        <p className={styles.none}>None gathered yet for {hotelName}.</p>
      </section>
    )
  }
  const a = data.data
  const s = a.sentiment
  return (
    <section className={`panel ${styles.panel}`} aria-labelledby="sourced-h">
      <span className="eyebrow" id="sourced-h">
        Aggregated data
      </span>
      <p className={styles.intro}>Stays members described on FlyerTalk and Reddit, read and tallied. Each rate counts only the posts that said. Kept apart from reader submissions.</p>
      <div className={styles.figures}>
        <div>
          <div className={styles.n}>{pct(a.upgrade)}</div>
          <div className={styles.l}>Got an upgrade</div>
          <div className={styles.of}>{of(a.upgrade)}</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.suite)}</div>
          <div className={styles.l}>Got a suite</div>
          <div className={styles.of}>{of(a.suite)}</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.breakfast)}</div>
          <div className={styles.l}>Breakfast honoured</div>
          <div className={styles.of}>{of(a.breakfast)}</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.lounge)}</div>
          <div className={styles.l}>Lounge access</div>
          <div className={styles.of}>{of(a.lounge)}</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.lateCheckout)}</div>
          <div className={styles.l}>Late checkout</div>
          <div className={styles.of}>{of(a.lateCheckout)}</div>
        </div>
      </div>
      <ul className={styles.rows}>
        {data.rows.map((r) => (
          <li key={r.id}>
            <div className={styles.meta}>
              <span>{[r.tier, monthLabel(r.when)].filter(Boolean).join(' · ')}</span>
              <a href={r.postUrl} target="_blank" rel="noopener noreferrer nofollow">
                {SOURCE_LABEL[r.source] ?? r.source} ↗
              </a>
            </div>
            <p>{r.summary}</p>
          </li>
        ))}
      </ul>
      <div className="panel-foot">
        From {a.stays} reported {a.stays === 1 ? 'stay' : 'stays'}
        {a.latest ? `, most recent ${monthLabel(a.latest)}` : ''}; {s.positive} positive, {s.mixed} mixed, {s.negative} negative. Read from public posts, summarised in our words, never scored.
      </div>
    </section>
  )
}
