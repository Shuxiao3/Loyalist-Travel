'use client'

import { useEffect } from 'react'

// On a phone a row of tabs (kit: .tabs) scrolls sideways, so the current tab can sit off the
// screen ("IHG One Rewards" on the Hotels list). On arrival, and whenever `current` changes, each
// row whose current tab is not fully in view scrolls just far enough to show it, with a little room.
// Rows that fit, and desktop, are left alone. Renders nothing.
export function CurrentTabInView({ current }: { current?: string | null }) {
  useEffect(() => {
    for (const tab of document.querySelectorAll<HTMLElement>('.tabs > [aria-current="page"]')) {
      const row = tab.parentElement
      if (!row || row.scrollWidth <= row.clientWidth) continue
      const r = row.getBoundingClientRect()
      const t = tab.getBoundingClientRect()
      const room = 32
      if (t.right > r.right - 8) row.scrollLeft += t.right - r.right + room
      else if (t.left < r.left + 8) row.scrollLeft -= r.left - t.left + room
    }
  }, [current])
  return null
}
