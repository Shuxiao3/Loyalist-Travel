'use client'

import { useActionState, useEffect, useState } from 'react'

import { submitStay, type SubmitStayState } from '@/app/actions/submitStay'
import { stayYearOptions, SUITE_AWARD, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '@/lib/stayOptions'

import { Turnstile } from './Turnstile'
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
// upgrade question unfolds only as far as the answer needs.
export function StayForm({ hotel, programName, tiers, compact }: { hotel: { id: number; name: string }; programName: string; tiers: StayFormTier[]; compact?: boolean }) {
  const [state, action, pending] = useActionState<SubmitStayState, FormData>(submitStay, null)
  const [statusHeld, setStatusHeld] = useState('')
  const [upgrade, setUpgrade] = useState('')
  const [upgradeType, setUpgradeType] = useState('')
  const [suiteAward, setSuiteAward] = useState('')
  const years = stayYearOptions()

  // Preselect the tier the reader saved on their account. Asked for here rather
  // than passed in, because the hotel pages this form sits on are cached and
  // shared between visitors — one reader's status must not be baked into HTML
  // everyone else is served. Signed out, nothing happens.
  useEffect(() => {
    let alive = true
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        const held: number[] = Array.isArray(s?.reader?.tiers) ? s.reader.tiers : []
        const match = tiers.find((t) => held.includes(t.id))
        if (alive && match) setStatusHeld(String(match.id))
      })
      .catch(() => {
        /* the reader fills it in, as before */
      })
    return () => {
      alive = false
    }
  }, [tiers])

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

  return (
    <form action={action} className={`${styles.form} ${compact ? styles.compact : ''}`}>
      <input type="hidden" name="hotel" value={hotel.id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Select
        name="statusHeld"
        label={`Status held · ${programName}`}
        placeholder="Choose a tier"
        value={statusHeld}
        onChange={setStatusHeld}
        options={tiers.map((t) => ({ value: String(t.id), label: t.shortName ?? t.name }))}
      />
      <Select name="stayYear" label="Year of the stay" placeholder="Year" options={years} />

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
      <Select name="suiteAward" label="Used a suite upgrade certificate?" placeholder="Yes or no" options={SUITE_AWARD} value={suiteAward} onChange={setSuiteAward} />
      {suiteAward === 'yes' && !(upgraded && upgradeType === 'suite') && (
        <div className={styles.follow}>
          <Select name="awardSuiteType" label="Which suite did it get you" placeholder="Which kind" options={SUITE_TYPES} />
        </div>
      )}

      <Turnstile resetKey={state} />

      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Submit the stay'}
        </button>
        <span className={styles.fine}>No name, no email. Checked before it counts.</span>
      </div>
    </form>
  )
}
