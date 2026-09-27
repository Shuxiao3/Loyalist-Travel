'use client'

import { useActionState } from 'react'

import { saveTiers, type TiersState } from '@/app/actions/account'

import styles from './TiersForm.module.css'

export type TierChoice = { id: number; label: string }
export type ProgramTiers = { id: number; name: string; tiers: TierChoice[]; current: number | null }

// One dropdown per programme. "No status" is a real answer and the default, so
// the list is not a demand to have status in all four.
export function TiersForm({ programs }: { programs: ProgramTiers[] }) {
  const [state, action, pending] = useActionState<TiersState, FormData>(saveTiers, null)

  return (
    <form action={action} className={styles.form}>
      {programs.map((program) => (
        <label className={styles.field} key={program.id}>
          <span className="label">{program.name}</span>
          <select name={`tier-${program.id}`} defaultValue={program.current ? String(program.current) : ''}>
            <option value="">No status</option>
            {program.tiers.map((tier) => (
              <option key={tier.id} value={String(tier.id)}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className={styles.saved}>Saved.</p>}
      <button className="ghost" type="submit" disabled={pending}>
        {pending ? 'Saving' : 'Save status'}
      </button>
    </form>
  )
}
