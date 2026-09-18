import Link from 'next/link'

import { accessLine, type LoungeRow, servicesLine } from '@/lib/lounges'

import styles from './LoungeRows.module.css'

// Directory rows from the homepage mockup: name and hotel, the access and
// service line, the reader score on the right.
export function LoungeRows({ rows }: { rows: LoungeRow[] }) {
  return (
    <div className={styles.rows}>
      {rows.map(({ lounge, hotel, data }) => (
        <Link className={styles.row} href={`/lounges/${lounge.slug}`} key={lounge.id}>
          <div>
            <div className={styles.t}>
              {lounge.name}
              {hotel ? `, ${hotel.name}` : ''}
            </div>
            <div className={styles.m}>{[accessLine(lounge), servicesLine(lounge)].filter(Boolean).join(' · ')}</div>
          </div>
          <div className={styles.s}>
            {data?.score != null ? (
              <>
                <div className={styles.v}>
                  {data.score.toFixed(1)}
                  <span className={styles.of}>/5</span>
                </div>
                <div className={styles.l}>Reader score</div>
              </>
            ) : (
              <div className={styles.l}>Not yet rated</div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
