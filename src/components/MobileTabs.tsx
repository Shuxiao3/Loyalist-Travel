'use client'

import { useState } from 'react'

import styles from './MobileTabs.module.css'

export type TabPanel = { id: string; label: string; content: React.ReactNode }

// On phones, panels sit behind a tab bar and one shows at a time. Wider
// than a phone the bar is hidden and every panel shows, in the layout the
// page gives them via `className`.
export function MobileTabs({ panels, className }: { panels: TabPanel[]; className?: string }) {
  const [active, setActive] = useState(panels[0]?.id)
  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="tablist" aria-label="Sections">
        {panels.map((p) => (
          <button key={p.id} type="button" role="tab" id={`tab-${p.id}`} aria-selected={active === p.id} aria-controls={`panel-${p.id}`} className={`${styles.tab} ${active === p.id ? styles.on : ''}`} onClick={() => setActive(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className={className}>
        {panels.map((p) => (
          <div key={p.id} id={`panel-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} className={`${styles.panel} ${active === p.id ? styles.active : ''}`}>
            {p.content}
          </div>
        ))}
      </div>
    </div>
  )
}
