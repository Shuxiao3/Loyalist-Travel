'use client'

import { useActionState } from 'react'

import { submitStay, type SubmitStayState } from '@/app/actions/submitStay'
import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, UPGRADE_OUTCOMES } from '@/collections/ReaderStays'

import styles from './StayForm.module.css'

export type StayFormTier = { id: number; name: string; shortName?: string | null }

// Two minutes, dropdowns only. Hotel and program come from the page.
export function StayForm({ hotel, programName, tiers, compact }: { hotel: { id: number; name: string }; programName: string; tiers: StayFormTier[]; compact?: boolean }) {
  const [state, action, pending] = useActionState<SubmitStayState, FormData>(submitStay, null)
  const now = new Date()
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  if (state?.ok) {
    return (
      <div className={styles.done}>
        <span className="eyebrow">Thank you</span>
        <h3>Your stay is in the queue.</h3>
        <p>It joins the data for {hotel.name} once it has been checked. The upgrade odds update for everyone.</p>
      </div>
    )
  }

  return (
    <form action={action} className={`${styles.form} ${compact ? styles.compact : ''}`}>
      <input type="hidden" name="hotel" value={hotel.id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className={styles.field}>
        <span className="label">Status held · {programName}</span>
        <select name="statusHeld" required defaultValue="">
          <option value="" disabled>
            Choose a tier
          </option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.shortName ?? t.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className="label">Year of the stay</span>
        <select name="stayYear" required defaultValue="">
          <option value="" disabled>
            Year
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className="label">Upgrade at check-in</span>
        <select name="upgrade" required defaultValue="">
          <option value="" disabled>
            What happened
          </option>
          {UPGRADE_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className="label">Breakfast</span>
        <select name="breakfast" required defaultValue="">
          <option value="" disabled>
            What happened
          </option>
          {BREAKFAST_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className="label">Late checkout</span>
        <select name="lateCheckout" required defaultValue="">
          <option value="" disabled>
            What happened
          </option>
          {LATE_CHECKOUT_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Submit the stay'}
        </button>
        <span className={styles.fine}>No name, no email, no comment. Checked before it counts.</span>
      </div>
    </form>
  )
}
