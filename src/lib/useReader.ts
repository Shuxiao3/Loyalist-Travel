'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export type ReaderSession = { loaded: boolean; signedIn: boolean; name: string | null; blocked: boolean }

const SIGNED_OUT: ReaderSession = { loaded: true, signedIn: false, name: null, blocked: false }

// The header lives in the layout, which survives client-side navigation, so a
// hook that read the session once on mount kept its first answer for the rest
// of the visit: sign out and the header still said your name until a hard
// reload. Keyed on the path instead, so every navigation asks again — which is
// exactly when the answer can have changed, since signing in, signing out and
// saving a display name all end in one.
//
// Both header instances (wide and narrow) mount together and would otherwise
// ask twice per navigation, so a request in flight for a path is shared.
let inFlight: { key: string; promise: Promise<ReaderSession> } | null = null

function load(key: string): Promise<ReaderSession> {
  if (inFlight?.key === key) return inFlight.promise
  const promise = fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      const signedIn = Boolean(s?.reader?.id)
      return { loaded: true, signedIn, name: signedIn ? (s.reader.displayName ?? null) : null, blocked: Boolean(s?.reader?.blocked) }
    })
    .catch(() => SIGNED_OUT)
  inFlight = { key, promise }
  return promise
}

// The signed-in reader as the browser sees it, from the session endpoint.
// Lets cached pages show reader-specific bits after paint.
export function useReader(): ReaderSession {
  const pathname = usePathname()
  const [state, setState] = useState<ReaderSession>({ loaded: false, signedIn: false, name: null, blocked: false })

  useEffect(() => {
    let alive = true
    load(pathname).then((next) => {
      if (alive) setState(next)
    })
    return () => {
      alive = false
    }
  }, [pathname])

  return state
}
