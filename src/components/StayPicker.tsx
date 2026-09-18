'use client'

import { useEffect, useState } from 'react'

import { StayForm, type StayFormLounge, type StayFormTier } from './StayForm'
import styles from './StayPicker.module.css'

type HotelHit = { id: number; name: string; program: { id: number; name: string } | number; destination?: { locationLabel?: string | null; name?: string } | number | null }

// The general form: find the hotel first, then the same form as a hotel page.
export function StayPicker() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<HotelHit[]>([])
  const [chosen, setChosen] = useState<HotelHit | null>(null)
  const [tiers, setTiers] = useState<StayFormTier[] | null>(null)
  const [lounges, setLounges] = useState<StayFormLounge[] | null>(null)

  useEffect(() => {
    if (chosen || q.trim().length < 2) {
      setHits([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '8', depth: '1', 'where[name][contains]': q.trim(), 'where[_status][equals]': 'published', sort: 'name' })
        const res = await fetch(`/api/hotels?${params}`, { signal: ctrl.signal })
        const data = await res.json()
        setHits(data.docs ?? [])
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
    // the hotel's lounges, so the lounge questions appear here too
    const lp = new URLSearchParams({ limit: '10', depth: '0', 'where[hotel][equals]': String(chosen.id), 'where[_status][equals]': 'published', sort: 'name' })
    fetch(`/api/lounges?${lp}`)
      .then((r) => r.json())
      .then((d) => setLounges((d.docs ?? []).map((l: { id: number; name: string }) => ({ id: l.id, name: l.name }))))
      .catch(() => setLounges([]))
  }, [chosen])

  if (chosen) {
    const programName = typeof chosen.program === 'object' ? chosen.program.name : ''
    const place = typeof chosen.destination === 'object' ? (chosen.destination?.locationLabel ?? chosen.destination?.name) : null
    return (
      <div>
        <div className={styles.chosen}>
          <span>
            <span className="label">Hotel</span>
            <span className={styles.chosenName}>{chosen.name}</span>
            {place && <span className={styles.chosenPlace}>{place}</span>}
          </span>
          <button
            type="button"
            className={styles.change}
            onClick={() => {
              setChosen(null)
              setTiers(null)
              setLounges(null)
            }}
          >
            Change
          </button>
        </div>
        {tiers && lounges ? <StayForm hotel={{ id: chosen.id, name: chosen.name }} programName={programName} tiers={tiers} lounges={lounges} /> : <p className={styles.loading}>Loading tiers…</p>}
      </div>
    )
  }

  return (
    <div className={styles.search}>
      <label className={styles.field}>
        <span className="label">Which hotel?</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing the hotel name" autoComplete="off" />
      </label>
      {hits.length > 0 && (
        <ul className={styles.hits} role="listbox">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" role="option" aria-selected={false} onClick={() => setChosen(h)}>
                <span className={styles.hitName}>{h.name}</span>
                <span className={styles.hitMeta}>
                  {[typeof h.program === 'object' ? h.program.name : null, typeof h.destination === 'object' ? (h.destination?.locationLabel ?? h.destination?.name) : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className={styles.loading}>No hotel by that name yet.</p>}
    </div>
  )
}
