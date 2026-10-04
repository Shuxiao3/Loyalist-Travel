import { CONFIDENCE_TIP } from '@/lib/recency'
import type { HotelSourcedData } from '@/lib/sourcedData'
import { monthLabel, SOURCE_LABEL } from '@/lib/sourcedData'

import { ConfidenceDot } from './ConfidenceDot'

import styles from './SourcedPanel.module.css'

const pct = (r: { value: number | null; n: number }) => (r.value == null ? '–' : `${r.value}%`)
const of = (r: { value: number | null; n: number }) => (r.n > 0 ? `of ${r.n}` : 'none said')

// The aggregated-data panel on a hotel page: stays members reported on
// forums and blogs, tallied overall and by status band, then each stay
// behind a fold with a link to its post.
export function SourcedPanel({ data, hotelName }: { data: HotelSourcedData; hotelName: string }) {
  if (!data.data) {
    return (
      <section className={`panel ${styles.panel}`} aria-labelledby="sourced-h">
        <span className="eyebrow" id="sourced-h">
          Aggregated data
        </span>
        <p className={styles.intro}>Data aggregated from FlyerTalk and various blogs, tallied to give a rough idea of your chances at an upgrade.</p>
        <p className={styles.none}>None gathered yet for {hotelName}.</p>
      </section>
    )
  }
  const a = data.data
  return (
    <section className={`panel ${styles.panel}`} aria-labelledby="sourced-h">
      <div className={styles.head}>
        <span className="eyebrow" id="sourced-h">
          Aggregated data
        </span>
        <ConfidenceDot level={a.confidence} label={`Confidence: ${a.confidence}`} tip={CONFIDENCE_TIP} className={styles.badge} />
      </div>
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
          <div className={styles.n}>{pct(a.suiteNoCert)}</div>
          <div className={styles.l}>Suite without a certificate</div>
          <div className={styles.of}>{of(a.suiteNoCert)}</div>
        </div>
      </div>
      <p className={styles.intro}>Data aggregated from FlyerTalk and various blogs, tallied to give a rough idea of your chances at an upgrade.</p>
      {data.bands.length > 0 && (
        <table className={styles.tiers}>
          <thead>
            <tr>
              <th>Status held</th>
              <th>Stays</th>
              <th>Upgrade</th>
              <th>Suite</th>
              <th>Suite w/o certificate</th>
            </tr>
          </thead>
          <tbody>
            {data.bands.map((b) => (
              <tr key={b.label}>
                <td>
                  <ConfidenceDot level={b.data.confidence} label="" note={`Confidence ${b.data.confidence} for this band`} /> {b.label}
                </td>
                <td>{b.data.stays}</td>
                <td>{pct(b.data.upgrade)}</td>
                <td>{pct(b.data.suite)}</td>
                <td>{pct(b.data.suiteNoCert)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className={styles.rows}>
        {data.rows.map((r) => (
          <li key={r.id}>
            <details className={styles.stay}>
              <summary>
                <span className={styles.meta}>
                  <ConfidenceDot level={r.recency} label="" note={r.recency === 'high' ? 'Within the last year' : r.recency === 'medium' ? 'One to two and a half years ago' : 'Over two and a half years ago, or undated'} />
                  {[r.tier, monthLabel(r.when)].filter(Boolean).join(' · ')}
                  <em>{SOURCE_LABEL[r.source] ?? r.source}</em>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <p>{r.summary}</p>
              <a href={r.postUrl} target="_blank" rel="noopener noreferrer nofollow">
                Read the post on {SOURCE_LABEL[r.source] ?? r.source} ↗
              </a>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
