'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { StayForm, type StayFormTier } from './StayForm'
import styles from './StayPicker.module.css'

type HotelHit = {
  id: number
  name: string
  slug?: string | null
  program: { id: number; name: string } | number
  destination?: { locationLabel?: string | null; name?: string } | number | null
}

const HITS = 8

const programOf = (h: HotelHit) => (typeof h.program === 'object' ? h.program.name : '')
const placeOf = (h: HotelHit) => (typeof h.destination === 'object' ? (h.destination?.locationLabel ?? h.destination?.name ?? null) : null)

// The general form: find the hotel, then the same questions as a hotel page. The hotel step is
// a search box with a list of matches (mockup: submit-a-stay-search.html), then the chosen
// hotel with a way to change it (submit-a-stay.html). The rest of the form shows from the
// start; its tier list follows the chosen hotel's program.
export function StayPicker() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<HotelHit[]>([])
  const [more, setMore] = useState(false)
  const [searched, setSearched] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [chosen, setChosen] = useState<HotelHit | null>(null)
  const [tiers, setTiers] = useState<StayFormTier[] | null>(null)
  // A new round of the form after a stay was sent, so "Change" starts a fresh one.
  const [round, setRound] = useState(0)
  const sent = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const refocus = useRef(false)
  const inputId = useId()
  const listId = useId()

  useEffect(() => {
    if (chosen || q.trim().length < 2) {
      setHits([])
      setMore(false)
      setSearched('')
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: String(HITS), depth: '1', 'where[name][contains]': q.trim(), 'where[_status][equals]': 'published', sort: 'name' })
        const res = await fetch(`/api/hotels?${params}`, { signal: ctrl.signal })
        const data = await res.json()
        setHits(data.docs ?? [])
        setMore(Boolean(data.hasNextPage))
        setSearched(q.trim())
        setActive(-1)
      } catch {
        /* typing on */
      }
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, chosen])

  useEffect(() => {
    if (!chosen) return
    const programId = typeof chosen.program === 'object' ? chosen.program.id : chosen.program
    const params = new URLSearchParams({ limit: '20', depth: '0', 'where[program][equals]': String(programId), sort: 'rank' })
    fetch(`/api/status-levels?${params}`)
      .then((r) => r.json())
      .then((d) => setTiers(d.docs ?? []))
      .catch(() => setTiers([]))
  }, [chosen])

  // back on the search box after "Change"
  useEffect(() => {
    if (!chosen && refocus.current) {
      refocus.current = false
      input.current?.focus()
    }
  }, [chosen])

  const choose = (h: HotelHit) => {
    setChosen(h)
    setTiers(null)
    setOpen(false)
  }

  const change = () => {
    if (sent.current) {
      sent.current = false
      setRound((r) => r + 1)
    }
    refocus.current = true
    setChosen(null)
    setTiers(null)
    setOpen(true)
  }

  const onSent = useCallback(() => {
    sent.current = true
  }, [])

  const listed = open && hits.length > 0
  const noMatch = open && searched !== '' && searched === q.trim() && hits.length === 0

  const hotelStep = chosen ? (
    <div className={styles.chosen}>
      <div>
        <p className={styles.name}>{chosen.slug ? <Link href={`/hotels/${chosen.slug}`}>{chosen.name}</Link> : chosen.name}</p>
        <p className="meta">{[programOf(chosen), placeOf(chosen)].filter(Boolean).join(' · ')}</p>
      </div>
      <button type="button" className={`link ${styles.change}`} onClick={change}>
        Change
      </button>
    </div>
  ) : (
    <div className={styles.combo}>
      <label className={styles.q} htmlFor={inputId}>
        Which hotel?
      </label>
      <div className={styles.box}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          ref={input}
          className="input"
          id={inputId}
          type="search"
          value={q}
          placeholder="Start typing the hotel name"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listed}
          aria-controls={listId}
          aria-activedescendant={listed && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && hits.length) {
              e.preventDefault()
              setOpen(true)
              setActive((i) => (i + 1) % hits.length)
            } else if (e.key === 'ArrowUp' && hits.length) {
              e.preventDefault()
              setOpen(true)
              setActive((i) => (i <= 0 ? hits.length - 1 : i - 1))
            } else if (e.key === 'Enter') {
              // never submits the stay form from here
              e.preventDefault()
              const pick = listed ? (hits[active] ?? (hits.length === 1 ? hits[0] : null)) : null
              if (pick) choose(pick)
            } else if (e.key === 'Escape' && listed) {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />
        {listed && (
          // keeps the focus in the box while a match is clicked
          <ul className={styles.hits} id={listId} role="listbox" aria-label="Matching hotels" onMouseDown={(e) => e.preventDefault()}>
            {hits.map((h, i) => (
              <li key={h.id} role="presentation" className={i === active ? styles.on : undefined}>
                <button type="button" role="option" id={`${listId}-${i}`} aria-selected={i === active} tabIndex={-1} onClick={() => choose(h)}>
                  <b>{h.name}</b>
                  <span>{[programOf(h), placeOf(h)].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
            {more && (
              <li role="presentation" className={styles.foot}>
                More hotels match. Keep typing to narrow the list.
              </li>
            )}
          </ul>
        )}
        {noMatch && <p className="help">No hotel by that name yet.</p>}
      </div>
    </div>
  )

  return (
    <StayForm
      key={round}
      hotel={chosen ? { id: chosen.id, name: chosen.name } : null}
      programName={chosen ? programOf(chosen) : ''}
      tiers={chosen ? tiers : null}
      hotelStep={hotelStep}
      onSent={onSent}
    />
  )
}
