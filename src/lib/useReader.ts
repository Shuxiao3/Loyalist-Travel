'use client'

import { useEffect, useState } from 'react'

export type ReaderSession = { loaded: boolean; signedIn: boolean; name: string | null; blocked: boolean }

// The signed-in reader as the browser sees it, from the session endpoint.
// Lets cached pages show reader-specific bits after paint.
export function useReader(): ReaderSession {
  const [state, setState] = useState<ReaderSession>({ loaded: false, signedIn: false, name: null, blocked: false })
  useEffect(() => {
    let alive = true
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive) return
        const signedIn = Boolean(s?.reader?.id)
        setState({ loaded: true, signedIn, name: signedIn ? (s.reader.displayName ?? null) : null, blocked: Boolean(s?.reader?.blocked) })
      })
      .catch(() => alive && setState({ loaded: true, signedIn: false, name: null, blocked: false }))
    return () => {
      alive = false
    }
  }, [])
  return state
}
