'use client'

import { useActionState, useState } from 'react'

import { type LoungeRatingState, submitLoungeRating } from '@/app/actions/submitLoungeRating'
import { LOUNGE_COMMENT_MAX, LOUNGE_FACTORS, type LoungeFactor, LOUNGE_WORTH_IT, stayYearOptions } from '@/lib/stayOptions'
import { useReader } from '@/lib/useReader'

import { SegmentBar } from './SegmentBar'
import type { StayFormTier } from './StayForm'
import { Turnstile } from './Turnstile'
import styles from './StayForm.module.css'

type Option = { label: string; value: string }

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

// The lounge page's own form: status, year, the five bars, worth a club
// room, and a comment for signed-in readers.
export function LoungeRatingForm({ lounge, programName, tiers }: { lounge: { id: number; name: string }; programName: string; tiers: StayFormTier[] }) {
  const [state, action, pending] = useActionState<LoungeRatingState, FormData>(submitLoungeRating, null)
  const [scores, setScores] = useState<Record<LoungeFactor, number>>({ food: 0, drink: 0, space: 0, service: 0, overall: 0 })
  const reader = useReader()
  const years = stayYearOptions()

  if (state?.ok) {
    return (
      <div className={styles.done}>
        <span className="eyebrow">Thank you</span>
        <h3>Your rating is in the queue.</h3>
        <p>It joins the numbers for {lounge.name} once it has been checked.</p>
      </div>
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

      <Select name="statusHeld" label={`Status held · ${programName}`} placeholder="Choose a tier" options={tiers.map((t) => ({ value: String(t.id), label: t.shortName ?? t.name }))} />
      <Select name="stayYear" label="Year of the stay" placeholder="Year" options={years} />

      <p className={styles.hint}>Tap the bar to score each one, 1 to 5.</p>
      {LOUNGE_FACTORS.map((f) => (
        <SegmentBar key={f.name} name={f.name} label={f.label} value={scores[f.name]} onChange={(v) => setScores((s) => ({ ...s, [f.name]: v }))} />
      ))}
      <Select name="worthIt" label="Worth booking a club room for it?" placeholder="Yes or no" options={LOUNGE_WORTH_IT} />

      {reader.loaded &&
        (reader.signedIn && !reader.blocked ? (
          <label className={styles.field}>
            <span className="label">A line about the lounge · optional{reader.name ? ` · as ${reader.name}` : ''}</span>
            <textarea name="comment" maxLength={LOUNGE_COMMENT_MAX} rows={3} placeholder="What was good, what was not. Read before it posts." />
          </label>
        ) : (
          <p className={styles.hint}>
            <a href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}>Sign in</a> to add a line under your name. Scores count either way.
          </p>
        ))}

      <Turnstile resetKey={state} />

      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Rate the lounge'}
        </button>
        <span className={styles.fine}>No name unless you sign in. Checked before it counts.</span>
      </div>
    </form>
  )
}
