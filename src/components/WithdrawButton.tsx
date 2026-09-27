'use client'

import { useActionState } from 'react'

import { withdrawSubmission, type WithdrawState } from '@/app/actions/account'

import styles from './WithdrawButton.module.css'

// Only shown on pending items. Asks once, in the browser, because the action
// deletes without a second round trip.
export function WithdrawButton({ kind, id }: { kind: 'stay' | 'comment' | 'rating'; id: number }) {
  const [state, action, pending] = useActionState<WithdrawState, FormData>(withdrawSubmission, null)

  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={(e) => {
        if (!confirm('Withdraw this? It has not been read yet, so nothing has been published. You can submit again.')) e.preventDefault()
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? 'Withdrawing' : 'Withdraw'}
      </button>
      {state && !state.ok && <span className={styles.error}>{state.error}</span>}
    </form>
  )
}
