'use client'

import { type ReactNode, startTransition, useActionState, useEffect, useId, useState } from 'react'

import { submitStay, type SubmitStayState } from '@/app/actions/submitStay'
import { stayYearOptions, SUITE_AWARD, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '@/lib/stayOptions'

import { Turnstile } from './Turnstile'
import styles from './StayForm.module.css'

export type StayFormTier = { id: number; name: string; shortName?: string | null }

type Option = { label: string; value: string }

// One question as a row (mockup: submit-a-stay.html, .sf-row): the question on the left, its
// answers as radios on the right. Every answer is required; `grid` lays four answers out as
// a grid rather than a line.
function Choices({ name, question, options, value, onChange, grid, help }: { name: string; question: string; options: Option[]; value: string; onChange: (v: string) => void; grid?: boolean; help?: ReactNode }) {
  const id = useId()
  return (
    <div className={styles.row} role="radiogroup" aria-labelledby={id}>
      <p className={styles.q} id={id}>
        {question}
      </p>
      <div className={styles.a}>
        <div className={`choices ${grid ? styles.grid : ''}`}>
          {options.map((o) => (
            <label className="choice" key={o.value}>
              <input type="radio" name={name} value={o.value} required checked={value === o.value} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
        {help && <p className="help">{help}</p>}
      </div>
    </div>
  )
}

// The full add-your-stay form (the /submit-a-stay page, through StayPicker). Dropdowns for the
// tier and year, radios for the rest; the upgrade question unfolds only as far as the answer
// needs. The hotel step is the picker's, passed in as `hotelStep`, so the questions show from
// the start and the answers survive choosing or changing the hotel. Until a hotel is chosen
// the tier list waits for it. `onSent` tells the picker the stay went through.
export function StayForm({
  hotel,
  programName,
  tiers,
  hotelStep,
  onSent,
}: {
  hotel: { id: number; name: string } | null
  programName: string
  tiers: StayFormTier[] | null
  hotelStep: ReactNode
  onSent?: () => void
}) {
  const [state, action, pending] = useActionState<SubmitStayState, FormData>(submitStay, null)
  const [statusHeld, setStatusHeld] = useState('')
  const [stayYear, setStayYear] = useState('')
  const [upgrade, setUpgrade] = useState('')
  const [upgradeType, setUpgradeType] = useState('')
  const [suiteType, setSuiteType] = useState('')
  const [upgradeHow, setUpgradeHow] = useState('')
  const [suiteAward, setSuiteAward] = useState('')
  const [awardSuiteType, setAwardSuiteType] = useState('')
  const [noHotel, setNoHotel] = useState(false)
  const years = stayYearOptions()
  const tierId = useId()
  const yearId = useId()

  // Preselect the tier the reader saved on their account, once the hotel's tiers are known.
  // Asked for here rather than passed in, so no reader's status is ever baked into HTML that
  // is served to everyone. Signed out, nothing happens. A new hotel means a new program, so
  // the earlier pick is cleared first.
  useEffect(() => {
    setStatusHeld('')
    if (!tiers?.length) return
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

  const hotelId = hotel?.id
  useEffect(() => {
    if (hotelId) setNoHotel(false)
  }, [hotelId])

  const sent = Boolean(state?.ok)
  useEffect(() => {
    if (sent) onSent?.()
  }, [sent, onSent])

  if (sent) {
    return (
      <div className={styles.sf}>
        <section className={styles.step}>
          <h2 className={styles.h}>The hotel</h2>
          {hotelStep}
        </section>
        <div className={`form-ok ${styles.done}`} role="status">
          <h2>Your stay is in the queue.</h2>
          <p>It joins the data for {hotel?.name ?? 'that hotel'} once it has been checked. The upgrade odds update for everyone.</p>
        </div>
      </div>
    )
  }

  const upgraded = upgrade === 'yes'
  const tierOptions = (tiers ?? []).map((t) => ({ value: String(t.id), label: t.shortName ?? t.name }))
  const tierPlaceholder = !hotel ? 'Choose the hotel first' : !tiers ? 'Loading tiers' : 'Choose a tier'

  return (
    // Sent from onSubmit: the action prop alone resets the form after every reply, which would
    // clear the answers when the server asks for a correction. The action prop stays so the
    // form posts rather than navigates if it is ever sent before the script has loaded.
    <form
      className={styles.sf}
      action={action}
      onSubmit={(e) => {
        e.preventDefault()
        if (!hotel) {
          setNoHotel(true)
          e.currentTarget.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
          return
        }
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
    >
      {hotel && <input type="hidden" name="hotel" value={hotel.id} />}
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className={styles.step}>
        <h2 className={styles.h}>The hotel</h2>
        {hotelStep}
      </section>

      <section className={styles.step}>
        <h2 className={styles.h}>The stay</h2>
        <div className={`${styles.row} ${styles.pair}`}>
          <label className={`${styles.q} ${styles.q1}`} htmlFor={tierId}>
            Status held
            {hotel && programName && <span>{programName}</span>}
          </label>
          <select
            className={`select ${styles.s1}`}
            id={tierId}
            name="statusHeld"
            required
            disabled={!hotel || !tiers}
            value={hotel && tiers ? statusHeld : ''}
            onChange={(e) => setStatusHeld(e.target.value)}
          >
            <option value="" disabled>
              {tierPlaceholder}
            </option>
            {tierOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className={`${styles.q} ${styles.q2}`} htmlFor={yearId}>
            Year of the stay
          </label>
          <select className={`select ${styles.s2}`} id={yearId} name="stayYear" required value={stayYear} onChange={(e) => setStayYear(e.target.value)}>
            <option value="" disabled>
              Year
            </option>
            {years.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className={`help ${styles.ph}`}>{hotel ? 'Filled in from your account when you are signed in.' : "The tiers follow the hotel's program."}</p>
        </div>
      </section>

      <section className={styles.step}>
        <h2 className={styles.h}>The upgrade</h2>
        <Choices
          name="upgrade"
          question="Room upgrade?"
          options={UPGRADE_OUTCOMES}
          value={upgrade}
          onChange={(v) => {
            setUpgrade(v)
            if (v !== 'yes') setUpgradeType('')
          }}
          help={upgrade ? undefined : 'If yes, three short questions follow: what it was, which suite if a suite, and whether it was offered or asked for.'}
        />
        {upgraded && (
          <div className={styles.follow}>
            <Choices name="upgradeType" question="Upgraded to" options={UPGRADE_TYPES} value={upgradeType} onChange={setUpgradeType} grid />
            {upgradeType === 'suite' && <Choices name="suiteType" question="Which suite" options={SUITE_TYPES} value={suiteType} onChange={setSuiteType} grid />}
            <Choices name="upgradeHow" question="How it happened" options={UPGRADE_HOW} value={upgradeHow} onChange={setUpgradeHow} />
          </div>
        )}
        <Choices
          name="suiteAward"
          question="Used a suite upgrade certificate?"
          options={SUITE_AWARD}
          value={suiteAward}
          onChange={setSuiteAward}
          help="A confirmed suite award, such as Hyatt's suite upgrade award or Marriott's nightly upgrade award."
        />
        {suiteAward === 'yes' && !(upgraded && upgradeType === 'suite') && (
          <div className={styles.follow}>
            <Choices name="awardSuiteType" question="Which suite did it get you" options={SUITE_TYPES} value={awardSuiteType} onChange={setAwardSuiteType} grid />
          </div>
        )}
      </section>

      {noHotel ? (
        <p className={`form-alert ${styles.alert}`} role="alert">
          Choose the hotel first.
        </p>
      ) : (
        state &&
        !state.ok && (
          <p className={`form-alert ${styles.alert}`} role="alert">
            {state.error}
          </p>
        )
      )}

      <div className={styles.send}>
        <Turnstile resetKey={state} className={styles.check} />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Sending' : 'Submit the stay'}
          </button>
          <p className="help">No name, no email. Checked before it counts.</p>
        </div>
      </div>
    </form>
  )
}
