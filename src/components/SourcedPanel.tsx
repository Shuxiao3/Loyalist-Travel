import type { ReactNode } from 'react'

import type { HotelSourcedData, Rate, SourcedAggregate, SourcedRow } from '@/lib/sourcedData'
import { monthLabel } from '@/lib/sourcedData'

import { BreakdownWindow } from './BreakdownWindow'
import styles from './SourcedPanel.module.css'

// Aggregated data on a hotel page: stays members reported on forums and blogs (mockups:
// hotel.html, hotel-breakdown.html). The band shows the three figures and a line under them
// (SourcedFigures); "See the breakdown" opens the window (SourcedPanel) with the figures, the
// rates by status and every stay: its facts, the short summary and a muted "Source" link. Where
// the stays came from is not named on the page itself.

export const BREAKDOWN_ID = 'breakdown'

export const staysLabel = (n: number) => `${n} ${n === 1 ? 'stay' : 'stays'}`

function Fig({ rate, label }: { rate: Rate; label: string }) {
  return (
    <div className="fig">
      <p className="fig-n">{rate.value == null ? '–' : `${rate.value}%`}</p>
      <p className="fig-l">{label}</p>
      <p className="fig-s">{rate.n > 0 ? `of ${staysLabel(rate.n)}` : 'No stay said'}</p>
    </div>
  )
}

// The three figures (.figs), with a caption line under them.
export function SourcedFigures({ data, className = 'figs', children }: { data: SourcedAggregate; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Fig rate={data.upgrade} label="Got an upgrade" />
      <Fig rate={data.suite} label="Got a suite" />
      <Fig rate={data.suiteNoCert} label="Suite without a certificate" />
      <p className="figs-foot">{children}</p>
    </div>
  )
}

// "Aggregated data from 19 stays, newest Sep 2025. Confidence: medium. See the breakdown"
export function SourcedFoot({ data }: { data: SourcedAggregate }) {
  return (
    <>
      Aggregated data from {staysLabel(data.stays)}
      {data.latest ? `, newest ${monthLabel(data.latest)}` : ''}. Confidence: {data.confidence}.{' '}
      <a className="link" href={`#${BREAKDOWN_ID}`}>
        See the breakdown
      </a>
    </>
  )
}

function Cell({ rate, label }: { rate: Rate; label: string }) {
  return (
    <td className="r" data-label={label}>
      {rate.n > 0 && rate.value != null ? (
        <span className="v">
          <span className="pct">{rate.value}%</span> <span className="n">of {rate.n}</span>
        </span>
      ) : (
        <span className="na" aria-label="No stay said">
          –
        </span>
      )}
    </td>
  )
}

function Report({ row, undated }: { row: SourcedRow; undated?: boolean }) {
  const facts = row.facts.filter((f) => f.label !== 'Status')
  return (
    <li>
      <p className="r-when">
        {!undated && <b>{monthLabel(row.when)}</b>}
        <span className={undated && !row.tier ? styles.ns : undefined}>{row.tier ?? 'Status not stated'}</span>
      </p>
      <div className="r-body">
        {facts.length > 0 && (
          <p className="r-facts">
            {facts.map((f) => (
              <span key={f.label}>
                <i>{f.label}</i>
                {f.value}
              </span>
            ))}
          </p>
        )}
        <p className="r-sum">{row.summary}</p>
      </div>
      <a className="r-src" href={row.postUrl} target="_blank" rel="noopener noreferrer nofollow">
        Source
      </a>
    </li>
  )
}

// The breakdown window. Nothing when the hotel has no aggregated data.
export function SourcedPanel({ data, hotelName }: { data: HotelSourcedData; hotelName: string }) {
  const a = data.data
  if (!a) return null
  const dated = data.rows.filter((r) => r.when)
  const undated = data.rows.filter((r) => !r.when)
  return (
    <BreakdownWindow id={BREAKDOWN_ID} eyebrow="Aggregated data" title={hotelName} foot={`${staysLabel(a.stays)}${a.latest ? `, newest ${monthLabel(a.latest)}` : ''}`}>
      <SourcedFigures data={a} className="figs figs-sm">
        Confidence: {a.confidence}. From {staysLabel(a.stays)}, a rough idea of your chances at an upgrade.
      </SourcedFigures>
      {data.bands.length > 0 && (
        <section aria-labelledby="bd-status-h">
          <div className="mod-head thin">
            <h2 id="bd-status-h">By status</h2>
            <span className="aside">{staysLabel(a.stays)}</span>
          </div>
          <table className={`table table-stack ${styles.bands}`}>
            <thead>
              <tr>
                <th>Status</th>
                <th className="r">Upgrade</th>
                <th className="r">Suite</th>
                <th className="r">Suite without a certificate</th>
              </tr>
            </thead>
            <tbody>
              {data.bands.map((b) => (
                <tr key={b.label}>
                  <th scope="row">
                    {b.label} <span className="sub">{staysLabel(b.data.stays)}</span>
                  </th>
                  <Cell rate={b.data.upgrade} label="Upgrade" />
                  <Cell rate={b.data.suite} label="Suite" />
                  <Cell rate={b.data.suiteNoCert} label="Suite without a certificate" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section aria-labelledby="bd-every-h">
        <div className="mod-head thin">
          <h2 id="bd-every-h">Every stay</h2>
          <span className="aside">Newest first</span>
        </div>
        {dated.length > 0 && (
          <ol className="reports">
            {dated.map((r) => (
              <Report key={r.id} row={r} />
            ))}
          </ol>
        )}
        {undated.length > 0 && (
          <>
            <h3 className={styles.group}>Date not stated, {staysLabel(undated.length)}</h3>
            <ol className={`reports ${styles.undated}`}>
              {undated.map((r) => (
                <Report key={r.id} row={r} undated />
              ))}
            </ol>
          </>
        )}
      </section>
    </BreakdownWindow>
  )
}
