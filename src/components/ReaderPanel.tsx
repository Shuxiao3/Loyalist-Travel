import type { HotelReaderData } from '@/lib/readerData'
import { MIN_STAYS } from '@/lib/readerData'

import styles from './ReaderPanel.module.css'

const pct = (v: number | null) => (v == null ? '–' : `${v}%`)

// The reader-data panel on a hotel page: four rates, then a line per tier.
export function ReaderPanel({ data, hotelName }: { data: HotelReaderData; hotelName: string }) {
  if (!data.all) {
    return (
      <div className={`panel ${styles.panel}`}>
        <span className="eyebrow" id="reader-h">
          Reader data
        </span>
        <p className={styles.waiting}>
          {data.count === 0 ? 'No reader stays yet for ' : `${data.count} reader ${data.count === 1 ? 'stay' : 'stays'} so far for `}
          {hotelName}. Upgrade odds appear once {MIN_STAYS} stays have been checked.
        </p>
      </div>
    )
  }
  const a = data.all
  return (
    <section className={`panel ${styles.panel}`} aria-labelledby="reader-h">
      <span className="eyebrow" id="reader-h">
        Reader data
      </span>
      <div className={styles.figures}>
        <div>
          <div className={styles.n}>{pct(a.upgradeRate)}</div>
          <div className={styles.l}>Got an upgrade</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.suiteRate)}</div>
          <div className={styles.l}>Got a suite</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.proactiveRate)}</div>
          <div className={styles.l}>Upgrades offered unasked</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.breakfastRate)}</div>
          <div className={styles.l}>Breakfast as printed</div>
        </div>
        <div>
          <div className={styles.n}>{pct(a.lateCheckoutRate)}</div>
          <div className={styles.l}>Late checkout honoured</div>
        </div>
      </div>
      {data.byTier && data.byTier.length > 0 && (
        <table className={styles.tiers}>
          <thead>
            <tr>
              <th>Status held</th>
              <th>Stays</th>
              <th>Upgrade</th>
              <th>Suite</th>
              <th>Unasked</th>
              <th>Awards</th>
            </tr>
          </thead>
          <tbody>
            {data.byTier.map(({ tier, data: d }) => (
              <tr key={tier.id}>
                <td>{tier.shortName ?? tier.name}</td>
                <td>{d.stays}</td>
                <td>{pct(d.upgradeRate)}</td>
                <td>{pct(d.suiteRate)}</td>
                <td>{pct(d.proactiveRate)}</td>
                <td>{d.awardStays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="panel-foot">
        From {a.stays} reader {a.stays === 1 ? 'stay' : 'stays'}
        {a.latest ? `, most recent ${a.latest}` : ''}
        {a.awardStays > 0 ? `; ${a.awardStays} on suite ${a.awardStays === 1 ? 'award' : 'awards'}, left out of the upgrade rates` : ''}. Reported by readers, checked before counting, never scored.
      </div>
    </section>
  )
}
