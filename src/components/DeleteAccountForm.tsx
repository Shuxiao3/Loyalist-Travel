'use client'

import { useActionState, useState } from 'react'

import { deleteAccount, type DeleteState } from '@/app/actions/account'

import styles from './DeleteAccountForm.module.css'

// Folded away until asked for, and it wants the word typed. Closing an account
// cannot be undone, so it should not be one stray click from a page people
// visit to change their name.
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, null)

  if (!open) {
    return (
      <button type="button" className={styles.reveal} onClick={() => setOpen(true)}>
        Close my account
      </button>
    )
  }

  return (
    <form action={action} className={styles.form}>
      <p className={styles.what}>
        Your email address and this account go for good. The stays, comments and lounge ratings you sent stay on the site, no longer linked to you — the
        upgrade rates other readers rely on do not move because you left. Comments will show as &ldquo;Reader&rdquo;.
      </p>
      <label className={styles.field}>
        <span className="label">Type delete to confirm</span>
        <input type="text" name="confirm" autoComplete="off" placeholder="delete" required />
      </label>
      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={styles.row}>
        <button type="submit" className={styles.confirm} disabled={pending}>
          {pending ? 'Closing' : 'Close my account'}
        </button>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
          Keep it
        </button>
      </div>
    </form>
  )
}
