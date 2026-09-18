'use client'

import { useActionState } from 'react'

import { type AccountState, saveDisplayName } from '@/app/actions/account'
import { DISPLAY_NAME_MAX } from '@/lib/displayName'

import styles from './DisplayNameForm.module.css'

export function DisplayNameForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveDisplayName, null)
  return (
    <form action={action} className={styles.form}>
      <label className={styles.field}>
        <span className="label">Shown as</span>
        <input type="text" name="displayName" defaultValue={current ?? ''} maxLength={DISPLAY_NAME_MAX} placeholder="e.g. Suite Seeker" required autoComplete="nickname" />
      </label>
      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className={styles.saved}>Saved.</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Saving' : current ? 'Save name' : 'Use this name'}
      </button>
    </form>
  )
}
