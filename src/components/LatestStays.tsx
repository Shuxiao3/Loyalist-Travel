import { rel } from '@/lib/format'
import { SUITE_TYPES, UPGRADE_TYPES } from '@/lib/stayOptions'
import type { Reader, ReaderStay, StatusLevel } from '@/payload-types'

import styles from './LatestStays.module.css'

const label = (list: { label: string; value: string }[], v: string | null | undefined) => list.find((o) => o.value === v)?.label ?? null

function upgradeWords(s: ReaderStay): string {
  if (s.upgrade !== 'yes') return 'None'
  const what = s.upgradeType === 'suite' ? (label(SUITE_TYPES, s.suiteType) ?? 'Suite') : (label(UPGRADE_TYPES, s.upgradeType) ?? 'Yes')
  return `${what}${s.upgradeHow === 'proactive' ? ', offered without asking' : s.upgradeHow === 'asked' ? ', after asking' : ''}`
}

// with a certificate and no upgrade, the suite it got (as the stay records it)
const certWords = (s: ReaderStay): string => (s.upgrade === 'yes' ? 'Used' : (label(SUITE_TYPES, s.suiteType) ?? 'Used'))

// The most recent checked reader stays at a hotel, in the kit's report rows: the year and
// status held, the upgrade, and the reader's display name. They arrive newest added first;
// the rows run by the year of the stay, newest first, as the head says (a stay added today
// can be years old), keeping that order within a year.
export function LatestStays({ stays }: { stays: ReaderStay[] }) {
  if (stays.length === 0) return null
  const rows = [...stays].sort((a, b) => b.stayYear - a.stayYear)
  return (
    <div className={styles.wrap}>
      <div className="mod-head thin">
        <h3 className={styles.h}>Latest stays</h3>
        <span className="aside">Newest first</span>
      </div>
      <ol className="reports">
        {rows.map((s) => {
          const who = rel<Reader>(s.reader)
          const tier = rel<StatusLevel>(s.statusHeld)
          return (
            <li key={s.id}>
              <p className="r-when">
                <b>{s.stayYear}</b>
                <span>{tier?.shortName ?? tier?.name ?? 'Status not stated'}</span>
              </p>
              <div className="r-body">
                <p className="r-facts">
                  <span>
                    <i>Upgrade</i>
                    {upgradeWords(s)}
                  </span>
                  {s.suiteAward === 'yes' && (
                    <span>
                      <i>Suite certificate</i>
                      {certWords(s)}
                    </span>
                  )}
                </p>
              </div>
              <span className="r-src">{who?.displayName ?? 'A reader'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
