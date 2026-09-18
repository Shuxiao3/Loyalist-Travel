import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, SUITE_TYPES, UPGRADE_TYPES } from '@/collections/ReaderStays'
import { rel } from '@/lib/format'
import type { Reader, ReaderStay, StatusLevel } from '@/payload-types'

import styles from './LatestStays.module.css'

const label = (list: { label: string; value: string }[], v: string | null | undefined) => list.find((o) => o.value === v)?.label ?? null

function upgradeWords(s: ReaderStay): string {
  if (s.upgrade === 'award') return `Suite award: ${label(SUITE_TYPES, s.suiteType)?.toLowerCase() ?? 'suite'}`
  if (s.upgrade !== 'yes') return 'No upgrade'
  const what = s.upgradeType === 'suite' ? (label(SUITE_TYPES, s.suiteType) ?? 'Suite') : (label(UPGRADE_TYPES, s.upgradeType) ?? 'Upgraded')
  return `${what}${s.upgradeHow === 'proactive' ? ', unasked' : s.upgradeHow === 'asked' ? ', on request' : ''}`
}

// The most recent approved stays at a hotel: who, tier, year, and the three outcomes.
export function LatestStays({ stays }: { stays: ReaderStay[] }) {
  if (stays.length === 0) return null
  return (
    <div className={styles.wrap}>
      <span className="eyebrow on-light">Latest stays</span>
      <ol className={styles.list}>
        {stays.map((s) => {
          const who = rel<Reader>(s.reader)
          const tier = rel<StatusLevel>(s.statusHeld)
          return (
            <li className={styles.item} key={s.id}>
              <div className={styles.who}>
                <span className={styles.name}>{who?.displayName ?? 'Anonymous reader'}</span>
                <span className={styles.sub}>
                  {tier?.shortName ?? tier?.name ?? 'Member'} · {s.stayYear}
                </span>
              </div>
              <div className={styles.facts}>
                <span>{upgradeWords(s)}</span>
                <span>Breakfast: {label(BREAKFAST_OUTCOMES, s.breakfast)?.toLowerCase() ?? '–'}</span>
                <span>Late checkout: {label(LATE_CHECKOUT_OUTCOMES, s.lateCheckout)?.toLowerCase() ?? '–'}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
