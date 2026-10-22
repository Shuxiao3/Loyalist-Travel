'use client'

import { startTransition, useActionState, useId } from 'react'

import { saveTiers, type TiersState } from '@/app/actions/account'

import styles from './TiersForm.module.css'

export type TierChoice = { id: number; label: string }
export type ProgramTiers = { id: number; name: string; tiers: TierChoice[]; current: number | null }

// One dropdown per programme (mockup: account.html, .acct-tiers). "No status" is a real answer
// and the default, so the list is not a demand to have status in all four.
export function TiersForm({ programs }: { programs: ProgramTiers[] }) {
  const [state, action, pending] = useActionState<TiersState, FormData>(saveTiers, null)
  const id = useId()

  return (
    // Sent from onSubmit once the page has loaded: the action prop alone resets the form after
    // the reply, which put the old tiers back on screen right after "Saved.". The action prop
    // covers a press before that.
    <form
      action={action}
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
    >
      {programs.map((program) => (
        <div className={`field ${styles.field}`} key={program.id}>
          <label className="label" htmlFor={`${id}-${program.id}`}>
            {program.name}
          </label>
          <select className="select" id={`${id}-${program.id}`} name={`tier-${program.id}`} defaultValue={program.current ? String(program.current) : ''}>
            <option value="">No status</option>
            {program.tiers.map((tier) => (
              <option key={tier.id} value={String(tier.id)}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {state && !state.ok && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
      <div className={styles.actions}>
        <button className="btn btn-soft btn-sm" type="submit" disabled={pending}>
          {pending ? 'Saving' : 'Save status'}
        </button>
        {state?.ok && (
          <span className={styles.saved} role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  )
}
