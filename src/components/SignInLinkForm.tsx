'use client'

import { useActionState } from 'react'

import { type LinkState, requestSignInLink } from '@/app/actions/signInLink'

import styles from './SignInLinkForm.module.css'

// Email, then a link. Once it is sent the form is replaced rather than left
// sitting there, so nobody wonders whether to press it again.
export function SignInLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestSignInLink, null)

  if (state?.sent) {
    return (
      <p className={styles.sent}>
        Check your inbox. The link signs you in once, and works for fifteen minutes. If nothing arrives, look in spam before trying again.
      </p>
    )
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        <span className="label">Email</span>
        <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" inputMode="email" />
      </label>
      {state?.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button className="ghost" type="submit" disabled={pending}>
        {pending ? 'Sending' : 'Email me a link'}
      </button>
    </form>
  )
}
