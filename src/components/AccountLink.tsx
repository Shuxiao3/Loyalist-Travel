'use client'

import Link from 'next/link'

import { useReader } from '@/lib/useReader'

// "Sign in" or the reader's name, in the header.
export function AccountLink({ className }: { className?: string }) {
  const reader = useReader()
  if (!reader.loaded)
    return (
      <span className={className} aria-hidden="true" style={{ visibility: 'hidden' }}>
        Sign in
      </span>
    )
  return (
    <Link className={className} href={reader.signedIn ? '/account' : '/login'}>
      {reader.signedIn ? (reader.name ?? 'Account') : 'Sign in'}
    </Link>
  )
}
