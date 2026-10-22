'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useReader } from '@/lib/useReader'

// "Sign in", or the signed-in reader's way to their account. In the header (kit: .signin) the
// reader's name, which gives way to "Account" on narrower screens; in the footer "Your account".
export function AccountLink({ place = 'header' }: { place?: 'header' | 'footer' }) {
  const reader = useReader()
  const pathname = usePathname()
  const here = pathname.startsWith('/account') || pathname.startsWith('/login') ? 'page' : undefined

  if (place === 'footer') return reader.signedIn ? <Link href="/account">Your account</Link> : <Link href="/login">Sign in</Link>

  // until the session is known, hold the place without showing either
  if (!reader.loaded)
    return (
      <span className="signin" aria-hidden="true" style={{ visibility: 'hidden' }}>
        Sign in
      </span>
    )
  if (!reader.signedIn)
    return (
      <Link className="signin" href="/login" aria-current={here}>
        Sign in
      </Link>
    )
  const name = reader.name?.trim()
  return (
    <Link className="signin" href="/account" aria-current={here} title={name || undefined}>
      {name ? (
        <>
          <span className="signin-name">{name}</span>
          <span className="signin-short">Account</span>
        </>
      ) : (
        'Account'
      )}
    </Link>
  )
}
