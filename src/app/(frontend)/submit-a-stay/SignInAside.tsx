'use client'

import Link from 'next/link'

import { useReader } from '@/lib/useReader'

// The side note about saved status. The page itself is static, so whether the reader is
// signed in is asked from the browser: signed out it offers "Sign in", signed in their account.
export function SignInAside({ className }: { className?: string }) {
  const reader = useReader()
  const signedIn = reader.loaded && reader.signedIn
  return (
    <section className={className}>
      <h2 className="h4">{signedIn ? 'Your status' : 'Signed in?'}</h2>
      <p>Save the status you hold on your account and it fills in the status question. Each stay still records the tier you held on that stay.</p>
      <p>
        {signedIn ? (
          <Link className="link" href="/account">
            Your account
          </Link>
        ) : (
          <Link className="link" href="/login?next=/submit-a-stay">
            Sign in
          </Link>
        )}
      </p>
    </section>
  )
}
