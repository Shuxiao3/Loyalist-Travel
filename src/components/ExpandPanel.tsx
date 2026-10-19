'use client'

import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react'

import styles from './ExpandPanel.module.css'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A panel that shows a short summary on the page and opens, on a click
// anywhere on it, into a centred window with the full detail. The window
// grows out of the panel and shrinks back into it. It is the browser's own
// modal dialog, so focus stays inside while it is open, Esc closes it and
// focus returns to the panel after; a click outside the window closes it
// too, and the page behind does not scroll.
export function ExpandPanel({ className, labelledBy, summary, foot, detail, eyebrow, title, cta }: { className?: string; labelledBy?: string; summary: ReactNode; foot?: ReactNode; detail: ReactNode; eyebrow: string; title: string; cta: string }) {
  const card = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const closer = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const titleId = useId()

  // the transform that puts the window where the panel sits
  const fromCard = () => {
    const a = card.current?.getBoundingClientRect()
    const b = sheet.current?.getBoundingClientRect()
    if (!a || !b || !b.width) return 'none'
    const scale = a.width / b.width
    return `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${scale})`
  }

  const open = () => {
    const d = dialog.current
    if (!d || d.open) return
    d.showModal()
    closer.current?.focus()
    document.documentElement.classList.add(styles.locked)
    if (reduced()) return
    sheet.current?.animate([{ transform: fromCard(), opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  }

  const close = useCallback(() => {
    const d = dialog.current
    if (!d || !d.open || closing.current) return
    const done = () => {
      closing.current = false
      d.close()
      document.documentElement.classList.remove(styles.locked)
      opener.current?.focus()
    }
    if (reduced() || !sheet.current) return done()
    closing.current = true
    const anim = sheet.current.animate([{ transform: 'none', opacity: 1 }, { transform: fromCard(), opacity: 0 }], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)' })
    anim.onfinish = done
    anim.oncancel = done
  }, [])

  // Esc asks the dialog to cancel; close it the animated way instead
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      close()
    }
    d.addEventListener('cancel', onCancel)
    return () => {
      d.removeEventListener('cancel', onCancel)
      document.documentElement.classList.remove(styles.locked)
    }
  }, [close])

  return (
    <>
      <section className={`${className ?? ''} ${styles.card}`} ref={card} aria-labelledby={labelledBy}>
        {summary}
        <div className={styles.foot}>
          <span>{foot}</span>
          <button type="button" className={styles.open} onClick={open} aria-haspopup="dialog" ref={opener}>
            {cta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </section>
      {/* a click on the backdrop lands on the dialog itself, outside the sheet */}
      <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && close()}>
        <div className={`${className ?? ''} ${styles.sheet}`} ref={sheet}>
          <div className={styles.bar}>
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h3 className={styles.title} id={titleId}>
                {title}
              </h3>
            </div>
            <button type="button" className={styles.close} onClick={close} aria-label="Close" ref={closer}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          {detail}
        </div>
      </dialog>
    </>
  )
}
