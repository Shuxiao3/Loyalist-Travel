import { type HotelReaderData, MIN_STAYS } from '@/lib/readerData'
import type { ReaderStay } from '@/payload-types'

import { LatestStays } from './LatestStays'
import styles from './ReaderPanel.module.css'

const staysLabel = (n: number) => `${n} ${n === 1 ? 'stay' : 'stays'}`

function Fig({ value, label, n }: { value: number | null; label: string; n: number }) {
  return (
    <div className="fig">
      <p className="fig-n">{value == null ? '–' : `${value}%`}</p>
      <p className="fig-l">{label}</p>
      <p className="fig-s">of {staysLabel(n)}</p>
    </div>
  )
}

function Cell({ value, n, label }: { value: number | null; n: number; label: string }) {
  return (
    <td className="r" data-label={label}>
      {value == null || n === 0 ? (
        <span className="na" aria-label="No stays">
          –
        </span>
      ) : (
        <span className="v">
          <span className="pct">{value}%</span> <span className="n">of {n}</span>
        </span>
      )}
    </td>
  )
}

// Reader odds, a section of a hotel's breakdown window: like the aggregated data, they sit
// behind "See the breakdown", never open on the page. The stays readers added here: once the
// hotel has enough of them (MIN_STAYS), three figures, the rates by status, then the latest
// stays; before that, the latest stays alone with a line on when the odds appear; with none,
// nothing (the add-your-stay box says how many it takes).
export const hasReaderStays = (data: HotelReaderData, latest: ReaderStay[]) => Boolean(data.all) || latest.length > 0

export function ReaderPanel({ data, latest }: { data: HotelReaderData; latest: ReaderStay[] }) {
  const a = data.all
  if (!a) {
    if (latest.length === 0) return null
    return (
      <section aria-labelledby="bd-reader-h">
        <div className="mod-head thin">
          <h2 id="bd-reader-h">Reader odds</h2>
        </div>
        <p className={styles.waiting}>
          Readers have added {staysLabel(data.count)} here so far. The odds appear once {MIN_STAYS} stays have been checked.
        </p>
        <LatestStays stays={latest} />
      </section>
    )
  }
  const noCert = a.stays - a.certStays
  return (
    <section aria-labelledby="bd-reader-h">
      <div className="mod-head thin">
        <h2 id="bd-reader-h">Reader odds</h2>
        <span className="aside">Confidence: {a.confidence}</span>
      </div>
      <div className={`figs figs-sm ${styles.figs}`}>
        <Fig value={a.upgradeRate} label="Got an upgrade" n={a.stays} />
        <Fig value={a.suiteRate} label="Got a suite" n={a.stays} />
        <Fig value={a.suiteNoCertRate} label="Suite without a certificate" n={noCert} />
        <p className="figs-foot">
          From {staysLabel(a.stays)} readers added, {a.recent} from this year or last
          {a.latest ? `, newest ${a.latest}` : ''}
          {a.certStays > 0 ? `; ${a.certStays} with a suite certificate` : ''}. Recent stays count for more. Checked before counting, never scored.
        </p>
      </div>
      {data.byTier && data.byTier.length > 0 && (
        <table className={`table table-stack ${styles.tiers}`}>
          <thead>
            <tr>
              <th>Status</th>
              <th className="r">Upgrade</th>
              <th className="r">Suite</th>
              <th className="r">Suite without a certificate</th>
            </tr>
          </thead>
          <tbody>
            {data.byTier.map(({ tier, data: d }) => (
              <tr key={tier.id}>
                <th scope="row">
                  {tier.shortName ?? tier.name} <span className="sub">{staysLabel(d.stays)}</span>
                </th>
                <Cell value={d.upgradeRate} n={d.stays} label="Upgrade" />
                <Cell value={d.suiteRate} n={d.stays} label="Suite" />
                <Cell value={d.suiteNoCertRate} n={d.stays - d.certStays} label="Suite without a certificate" />
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <LatestStays stays={latest} />
    </section>
  )
}
