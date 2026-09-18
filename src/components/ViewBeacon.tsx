'use client'

import { useEffect } from 'react'

// Counts one view of a hotel page. Sent once per page load, after paint.
export function ViewBeacon({ hotel }: { hotel: number }) {
  useEffect(() => {
    const body = JSON.stringify({ hotel })
    const t = setTimeout(() => {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      else fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [hotel])
  return null
}
