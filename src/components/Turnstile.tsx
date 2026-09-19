'use client'

import { useEffect, useRef } from 'react'

import { TURNSTILE_FIELD } from '@/lib/turnstile'

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT
      s.async = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
      s.onerror = () => reject(new Error('turnstile failed to load'))
      document.head.appendChild(s)
    })
  }
  return loading
}

// The Cloudflare Turnstile box inside a form. Writes its token into a hidden
// field the server action checks. Renders nothing when the site key is not
// set, so forms work unchanged until the keys are added. `resetKey` changes
// after a failed submit so the token is fresh for the next try.
export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY || !box.current) return
    let cancelled = false
    const el = box.current
    loadTurnstile()
      .then((t) => {
        if (cancelled || widget.current) return
        widget.current = t.render(el, { sitekey: SITE_KEY, theme: 'light', size: 'flexible', 'response-field-name': TURNSTILE_FIELD })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (widget.current && window.turnstile) {
        try {
          window.turnstile.remove(widget.current)
        } catch {}
      }
      widget.current = null
    }
  }, [])

  useEffect(() => {
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }, [resetKey])

  if (!SITE_KEY) return null
  return <div ref={box} style={{ minHeight: 65, marginTop: 4 }} />
}
