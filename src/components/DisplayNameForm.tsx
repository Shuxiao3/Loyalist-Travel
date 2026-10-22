'use client'

import { startTransition, useActionState, useId } from 'react'

import { type AccountState, saveDisplayName } from '@/app/actions/account'
import { DISPLAY_NAME_MAX } from '@/lib/displayName'

import styles from './DisplayNameForm.module.css'

// The display name box on the account page (mockups: account.html, account-new.html): the name
// and its button on one line.
export function DisplayNameForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveDisplayName, null)
  const id = useId()
  return (
    // Sent from onSubmit once the page has loaded, so a name that is taken stays in the box to
    // be edited rather than being reset; the action prop covers a press before that.
    <form
      action={action}
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
    >
      <label className="label" htmlFor={id}>
        Shown as
      </label>
      <div className="inline-form">
        <input className="input" id={id} type="text" name="displayName" defaultValue={current ?? ''} maxLength={DISPLAY_NAME_MAX} placeholder="e.g. Suite Seeker" required autoComplete="nickname" />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Saving' : current ? 'Save name' : 'Use this name'}
        </button>
      </div>
      {state && !state.ok && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className={styles.saved} role="status">
          Saved.
        </p>
      )}
    </form>
  )
}
