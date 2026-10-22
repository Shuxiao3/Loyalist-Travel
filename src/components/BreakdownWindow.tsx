'use client'

import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef } from 'react'

import styles from './BreakdownWindow.module.css'

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// The kit's modal window (.modal-layer > .modal) as the browser's own modal dialog, for the
// "See the breakdown" window on a hotel page. Any link on the page to #<id> opens it; focus
// stays inside while it is open, Esc, the close button, the Close link and a click on the
// dimmed page all close it, and focus goes back to the link. Without script the same links
// still open it through :target (the kit's no-script route), and the close links clear it.
export function BreakdownWindow({ id, eyebrow, title, foot, children }: { id: string; eyebrow: string; title: string; foot: ReactNode; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = `${id}-title`

  const close = useCallback(() => {
    const d = dialog.current
    if (d?.open) d.close()
  }, [])

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    // from here on the script opens and closes the window; :target alone no longer shows it
    d.setAttribute('data-ready', '')
    const open = (from: HTMLElement | null) => {
      if (d.open) return
      opener.current = from
      d.showModal()
      d.scrollTop = 0
      d.querySelector<HTMLElement>('[data-scroll]')?.scrollTo(0, 0)
    }
    const onClick = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = e.target instanceof Element ? e.target.closest<HTMLElement>(`a[href="#${id}"]`) : null
      if (!link) return
      e.preventDefault()
      open(link)
    }
    const onClose = () => {
      if (window.location.hash === `#${id}`) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      opener.current?.focus()
      opener.current = null
    }
    // #breakdown in the address: on arrival (a shared link, or a click before the script ran),
    // or typed in later
    const onHash = () => {
      if (window.location.hash === `#${id}`) open(null)
    }
    document.addEventListener('click', onClick)
    window.addEventListener('hashchange', onHash)
    d.addEventListener('close', onClose)
    onHash()
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('hashchange', onHash)
      d.removeEventListener('close', onClose)
    }
  }, [id])

  const onCloseLink = (e: MouseEvent) => {
    e.preventDefault()
    close()
  }

  return (
    // a click on the dimmed page lands on the dialog itself, outside the window
    <dialog ref={dialog} id={id} className={`modal-layer ${styles.layer}`} aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="meta">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <a className="modal-close" href="#" aria-label="Close" onClick={onCloseLink}>
            <CloseIcon />
          </a>
        </div>
        <div className="modal-body" data-scroll>
          {children}
        </div>
        <div className="modal-foot">
          <span>{foot}</span>
          <a className="link" href="#" onClick={onCloseLink}>
            Close
          </a>
        </div>
      </div>
    </dialog>
  )
}
