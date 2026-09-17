'use client'

import { useActionState, useState } from 'react'

import { submitStay, type SubmitStayState } from '@/app/actions/submitStay'
import { ALA_CARTE_CAP, BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '@/collections/ReaderStays'

import styles from './StayForm.module.css'

export type StayFormTier = { id: number; name: string; shortName?: string | null }

type Option = { label: string; value: string }

// A dropdown with a placeholder. Controlled when the answer drives
// follow-up questions.
function Select({ name, label, options, placeholder, value, onChange }: { name: string; label: string; options: Option[]; placeholder: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <label className={styles.field}>
      <span className="label">{label}</span>
      <select name={name} required value={value} defaultValue={value === undefined ? '' : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Two minutes, dropdowns only. Hotel and program come from the page. The
// upgrade and breakfast questions unfold only as far as the answer needs.
export function StayForm({ hotel, programName, tiers, compact }: { hotel: { id: number; name: string }; programName: string; tiers: StayFormTier[]; compact?: boolean }) {
  const [state, action, pending] = useActionState<SubmitStayState, FormData>(submitStay, null)
  const [upgrade, setUpgrade] = useState('')
  const [upgradeType, setUpgradeType] = useState('')
  const [breakfast, setBreakfast] = useState('')
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

  const upgraded = upgrade === 'yes'
  const alaCarte = breakfast === 'full' || breakfast === 'a-la-carte'

  return (
    <form action={action} className={`${styles.form} ${compact ? styles.compact : ''}`}>
      <input type="hidden" name="hotel" value={hotel.id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Select name="statusHeld" label={`Status held · ${programName}`} placeholder="Choose a tier" options={tiers.map((t) => ({ value: String(t.id), label: t.shortName ?? t.name }))} />
      <Select name="stayYear" label="Year of the stay" placeholder="Year" options={years.map((y) => ({ value: String(y), label: String(y) }))} />

      <Select
        name="upgrade"
        label="Room upgrade?"
        placeholder="What happened"
        options={UPGRADE_OUTCOMES}
        value={upgrade}
        onChange={(v) => {
          setUpgrade(v)
          if (v !== 'yes') setUpgradeType('')
        }}
      />
      {upgraded && (
        <div className={styles.follow}>
          <Select name="upgradeType" label="Upgraded to" placeholder="What kind" options={UPGRADE_TYPES} value={upgradeType} onChange={setUpgradeType} />
          {upgradeType === 'suite' && <Select name="suiteType" label="Which suite" placeholder="Which kind" options={SUITE_TYPES} />}
          <Select name="upgradeHow" label="How it happened" placeholder="Offered or asked" options={UPGRADE_HOW} />
        </div>
      )}
      {upgrade === 'award' && (
        <div className={styles.follow}>
          <Select name="suiteType" label="Which suite were you placed in" placeholder="Which kind" options={SUITE_TYPES} />
        </div>
      )}

      <Select name="breakfast" label="Breakfast" placeholder="What you got" options={BREAKFAST_OUTCOMES} value={breakfast} onChange={setBreakfast} />
      {alaCarte && (
        <div className={styles.follow}>
          <Select name="alaCarteCap" label="Was the à la carte capped?" placeholder="Capped or not" options={ALA_CARTE_CAP} />
        </div>
      )}

      <Select name="lateCheckout" label="Late checkout" placeholder="What happened" options={LATE_CHECKOUT_OUTCOMES} />

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
