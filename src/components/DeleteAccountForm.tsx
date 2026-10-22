'use client'

import { useActionState, useId, useRef } from 'react'

import { deleteAccount, type DeleteState } from '@/app/actions/account'

import styles from './DeleteAccountForm.module.css'

// Folded away under a red "Close my account" until asked for, and it wants the word typed
// (mockup: account-close.html, .acct-close). Closing an account cannot be undone, so it should
// not be one stray click from a page people visit to change their name.
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, null)
  const fold = useRef<HTMLDetailsElement>(null)
  const id = useId()

  return (
    <details className={styles.fold} ref={fold}>
      <summary>Close my account</summary>
      <form action={action} className={styles.form}>
        <p>
          Your email address and this account go for good. The stays, comments and lounge ratings you sent stay on the site, no longer linked to you, so the
          upgrade rates other readers rely on do not move because you left. Comments will show as &ldquo;Reader&rdquo;.
        </p>
        <div className={`field ${styles.field}`}>
          <label className="label" htmlFor={id}>
            Type delete to confirm
          </label>
          <input className="input" id={id} type="text" name="confirm" autoComplete="off" placeholder="delete" required />
        </div>
        {state && !state.ok && (
          <p className="err" role="alert">
            {state.error}
          </p>
        )}
        <div className={`text-actions ${styles.actions}`}>
          <button type="submit" className={`btn ${styles.danger}`} disabled={pending}>
            {pending ? 'Closing' : 'Close my account'}
          </button>
          <button
            type="button"
            className={`link ${styles.keep}`}
            onClick={() => {
              if (fold.current) fold.current.open = false
            }}
          >
            Keep it
          </button>
        </div>
      </form>
    </details>
  )
}
