'use client'

import { useEffect, useId, useRef, useState } from 'react'

import styles from './SortMenu.module.css'

export type SortOption = { value: string; label: string }

// A sort button beside the filter button: the three-line "sort" icon, which
// opens a small menu. Picking an option sets the hidden `sort` field and
// submits the surrounding form, so it works like the other filters.
export function SortMenu({ options, value, name = 'sort' }: { options: SortOption[]; value?: string; name?: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(value ?? '')
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const active = options.find((o) => o.value === current) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (v: string) => {
    setCurrent(v)
    setOpen(false)
    if (input.current) {
      input.current.value = v
      input.current.form?.requestSubmit()
    }
  }

  return (
    <div className={styles.wrap} ref={root}>
      <input type="hidden" name={name} value={current} ref={input} readOnly />
      <button type="button" className={`${styles.btn} ${current ? styles.on : ''}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={`Sort: ${active?.label ?? 'default'}`} title={`Sort: ${active?.label ?? 'default'}`} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2 4h14M4 9h10M6.5 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </button>
      {open && (
        <div className={styles.menu} role="menu" id={id}>
          <span className={`label ${styles.head}`}>Sort by</span>
          {options.map((o) => (
            <button type="button" role="menuitemradio" aria-checked={o.value === current} className={`${styles.item} ${o.value === current ? styles.itemOn : ''}`} key={o.value} onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
