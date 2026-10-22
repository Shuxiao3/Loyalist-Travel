'use client'

import { useActionState, useEffect, useId, useState } from 'react'

import { submitStay, type SubmitStayState } from '@/app/actions/submitStay'
import { stayYearOptions, SUITE_AWARD, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '@/lib/stayOptions'

import type { StayFormTier } from './StayForm'
import { Turnstile } from './Turnstile'
import styles from './HotelStayForm.module.css'

type Option = { label: string; value: string }

// One dropdown in the kit's form markup, with a placeholder. Controlled when the answer
// drives follow-up questions.
function Select({ name, label, options, placeholder, value, onChange }: { name: string; label: string; options: Option[]; placeholder: string; value?: string; onChange?: (v: string) => void }) {
  const id = useId()
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select className="select" id={id} name={name} required value={value} defaultValue={value === undefined ? '' : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// The add-your-stay form in a hotel page's side column (mockup: hotel.html, .add-box). The same
// questions and server action as the full form (StayForm): dropdowns only, the upgrade
// question unfolding only as far as the answer needs, the reader's saved tier preselected.
export function HotelStayForm({ hotel, programName, tiers }: { hotel: { id: number; name: string }; programName: string; tiers: StayFormTier[] }) {
  const [state, action, pending] = useActionState<SubmitStayState, FormData>(submitStay, null)
  const [statusHeld, setStatusHeld] = useState('')
  const [upgrade, setUpgrade] = useState('')
  const [upgradeType, setUpgradeType] = useState('')
  const [suiteAward, setSuiteAward] = useState('')
  const years = stayYearOptions()

  // Preselect the tier the reader saved on their account. Asked for here rather than passed
  // in, because hotel pages are cached and shared between visitors: one reader's status must
  // not be baked into the HTML everyone else is served. Signed out, nothing happens.
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
        /* the reader picks it */
      })
    return () => {
      alive = false
    }
  }, [tiers])

  if (state?.ok) {
    return (
      <p className="form-ok" role="status">
        <b>Thank you, your stay is in the queue.</b> It joins the reader odds for {hotel.name} once it has been checked.
      </p>
    )
  }

  const upgraded = upgrade === 'yes'

  return (
    <form action={action} className={styles.form}>
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

      <div className={styles.wide}>
        <Turnstile resetKey={state} />
      </div>

      {state && !state.ok && (
        <p className={`form-alert ${styles.wide}`} role="alert">
          {state.error}
        </p>
      )}

      <div className={`form-actions ${styles.actions}`}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Submit the stay'}
        </button>
        <p className="help">No name, no email. Checked before it counts.</p>
      </div>
    </form>
  )
}
