'use client'

import { useActionState, useId, useState } from 'react'

import { type LoungeRatingState, submitLoungeRating } from '@/app/actions/submitLoungeRating'
import { LOUNGE_COMMENT_MAX, LOUNGE_FACTORS, type LoungeFactor, LOUNGE_WORTH_IT, stayYearOptions } from '@/lib/stayOptions'
import { useReader } from '@/lib/useReader'

import type { StayFormTier } from './StayForm'
import { Turnstile } from './Turnstile'
import styles from './LoungeRatingForm.module.css'

type Option = { label: string; value: string }

// One dropdown in the kit's form markup, with a placeholder
function Select({ name, label, options, placeholder, value, onChange }: { name: string; label: string; options: Option[]; placeholder: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select className="select" id={id} name={name} required value={value} onChange={(e) => onChange(e.target.value)}>
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

// A 1 to 5 score as five segments, filled navy up to the one chosen (radio buttons, so it works
// with a keyboard and a screen reader as a group)
function Segments({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className={`field ${styles.segRow}`} role="radiogroup" aria-labelledby={id}>
      <span className="label" id={id}>
        {label}
      </span>
      <div className={styles.seg}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= value ? styles.on : undefined}>
            <input type="radio" name={name} value={n} required checked={value === n} onChange={() => onChange(n)} aria-label={`${n} of 5`} />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// The lounge page's own form, in the side box (mockup: lounge.html, .lp-form): status, year, the
// five scores, worth a club room, and a line for signed-in readers. Every answer is held here,
// so a refused rating (the check failed, a score missing) keeps what was chosen.
export function LoungeRatingForm({ lounge, programName, tiers }: { lounge: { id: number; name: string }; programName: string; tiers: StayFormTier[] }) {
  const [state, action, pending] = useActionState<LoungeRatingState, FormData>(submitLoungeRating, null)
  const [statusHeld, setStatusHeld] = useState('')
  const [stayYear, setStayYear] = useState('')
  const [scores, setScores] = useState<Record<LoungeFactor, number>>({ food: 0, drink: 0, space: 0, service: 0, overall: 0 })
  const [worthIt, setWorthIt] = useState('')
  const [comment, setComment] = useState('')
  const reader = useReader()
  const years = stayYearOptions()
  const commentId = useId()

  if (state?.ok) {
    return (
      <p className="form-ok" role="status">
        <b>Thank you, your rating is in the queue.</b> It joins the scores for {lounge.name} once it has been checked.
      </p>
    )
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lounge" value={lounge.id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Select name="statusHeld" label={`Status held · ${programName}`} placeholder="Choose a tier" value={statusHeld} onChange={setStatusHeld} options={tiers.map((t) => ({ value: String(t.id), label: t.shortName ?? t.name }))} />
      <Select name="stayYear" label="Year of the stay" placeholder="Year" value={stayYear} onChange={setStayYear} options={years} />

      <p className={`help ${styles.hint}`}>Score each one, 1 to 5.</p>
      {LOUNGE_FACTORS.map((f) => (
        <Segments key={f.name} name={f.name} label={f.label} value={scores[f.name]} onChange={(v) => setScores((s) => ({ ...s, [f.name]: v }))} />
      ))}

      <fieldset className="field">
        <legend className="label">Worth booking a club room for it?</legend>
        <div className={`choices ${styles.choices}`}>
          {LOUNGE_WORTH_IT.map((o) => (
            <label className="choice" key={o.value}>
              <input type="radio" name="worthIt" value={o.value} required checked={worthIt === o.value} onChange={() => setWorthIt(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {!reader.loaded ? null : reader.signedIn && !reader.blocked ? (
        <div className="field">
          <label className="label" htmlFor={commentId}>
            A line about the lounge <span className="opt">(optional{reader.name ? `, as ${reader.name}` : ''})</span>
          </label>
          <textarea className="textarea" id={commentId} name="comment" maxLength={LOUNGE_COMMENT_MAX} rows={3} placeholder="What was good, what was not. Read before it posts." value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      ) : (
        <p className="help">
          <a className="link" href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}>
            Sign in
          </a>{' '}
          to add a line under your name. Scores count either way.
        </p>
      )}

      <div className={styles.wide}>
        <Turnstile resetKey={state} />
      </div>

      {state && !state.ok && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      <div className={`form-actions ${styles.actions}`}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Rate the lounge'}
        </button>
        <p className="help">No name unless you sign in. Checked before it counts.</p>
      </div>
    </form>
  )
}
