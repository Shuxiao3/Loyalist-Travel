import type { ReactNode } from 'react'

import type { HotelSourcedData, Rate, SourcedAggregate, SourcedRow } from '@/lib/sourcedData'
import { monthLabel } from '@/lib/sourcedData'

import { BreakdownWindow } from './BreakdownWindow'
import { ConfidenceDot, Dot } from './ConfidenceDot'
import styles from './SourcedPanel.module.css'

// Aggregated data on a hotel page: stays members reported on forums and blogs (mockups:
// hotel.html, hotel-breakdown.html). The band shows a label row ("Aggregated data" and the
// confidence dot), the three figures, then the stays they come from and a "See the breakdown"
// button (SourcedSummary). The button opens the window (SourcedPanel) with the confidence, the
// figures, the rates by status (each with its own dot) and every stay: its facts, the short
// summary and a muted "Source" link. Where the stays came from is not named on the page itself.

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

// The three figures (.figs) under a label row with the confidence, and a foot under them.
function Figures({ data, small, label, align, foot }: { data: SourcedAggregate; small?: boolean; label?: string; align: 'start' | 'end'; foot: ReactNode }) {
  return (
    <div className={`figs ${small ? 'figs-sm' : ''} ${styles.figs}`}>
      <div className={styles.figsHead}>
        {label && <span className={styles.figsLabel}>{label}</span>}
        <ConfidenceDot level={data.confidence} align={align} />
      </div>
      <Fig rate={data.upgrade} label="Got an upgrade" />
      <Fig rate={data.suite} label="Got a suite" />
      <Fig rate={data.suiteNoCert} label="Suite without a certificate" />
      {foot}
    </div>
  )
}

function OpenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

// The band's figures on a hotel page: "Aggregated data" and the confidence above them, then
// "From 19 stays, newest Sep 2025." and the "See the breakdown" button under them.
export function SourcedSummary({ data }: { data: SourcedAggregate }) {
  return (
    <Figures
      data={data}
      label="Aggregated data"
      align="end"
      foot={
        <div className={`figs-foot ${styles.foot}`}>
          <p>
            From {staysLabel(data.stays)}
            {data.latest ? `, newest ${monthLabel(data.latest)}` : ''}.
          </p>
          <a className={`btn btn-light ${styles.open}`} href={`#${BREAKDOWN_ID}`} aria-haspopup="dialog">
            See the breakdown
            <OpenIcon />
          </a>
        </div>
      }
    />
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
      <Figures data={a} small align="start" foot={<p className="figs-foot">From {staysLabel(a.stays)}, a rough idea of your chances at an upgrade.</p>} />
      {data.bands.length > 0 && (
        <section aria-labelledby="bd-status-h">
          <div className="mod-head thin">
            <h2 id="bd-status-h">By status</h2>
            <span className={`aside ${styles.legend}`}>
              Confidence:
              {(['high', 'medium', 'low'] as const).map((l) => (
                <span key={l}>
                  <Dot level={l} />
                  {l}
                </span>
              ))}
            </span>
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
                    <span className={styles.status}>
                      <Dot level={b.data.confidence} label={`Confidence: ${b.data.confidence}`} />
                      {b.label}
                    </span>{' '}
                    <span className="sub">{staysLabel(b.data.stays)}</span>
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
