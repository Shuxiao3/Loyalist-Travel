'use client'

import { startTransition, useActionState, useId } from 'react'

import { type LinkState, requestSignInLink } from '@/app/actions/signInLink'

import styles from './SignInLinkForm.module.css'

// Email, then a link (mockups: login.html, login-sent.html). Once it is sent the form is
// replaced rather than left sitting there, so nobody wonders whether to press it again.
export function SignInLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestSignInLink, null)
  const id = useId()

  if (state?.sent) {
    return (
      <p className={`form-ok ${styles.sent}`} role="status">
        Check your inbox. The link signs you in once, and works for fifteen minutes. If nothing arrives, look in spam before trying again.
      </p>
    )
  }

  return (
    // Once the page has loaded, sent from onSubmit: the action prop alone would empty the email
    // field whenever the reply is an error. The action prop stays for a press before the
    // script has loaded, so the address is posted, never put in the page's URL.
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
    >
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor={id}>
        Email
      </label>
      <div className={`inline-form ${styles.row}`}>
        <input className="input" id={id} type="email" name="email" required autoComplete="email" placeholder="you@example.com" inputMode="email" />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Email me a link'}
        </button>
      </div>
      {state?.error && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}
