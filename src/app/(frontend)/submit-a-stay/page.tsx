import type { Metadata } from 'next'

import { pageMeta } from '@/lib/seo'

import { StayPicker } from '@/components/StayPicker'

import styles from './page.module.css'

export const metadata: Metadata = pageMeta({ title: 'Submit a stay', description: 'Two minutes, no typing. Your upgrade, breakfast and late-checkout outcome joins the data for that hotel.', path: '/submit-a-stay' })

export default function SubmitStayPage() {
  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Reader data</span>
          <h1 className={styles.h1}>Stayed somewhere on status?</h1>
          <p className="sub">Two minutes, dropdowns only. Your upgrade, breakfast and late-checkout outcome joins the data for that property, and the upgrade odds update for everyone. No name, no email.</p>
        </div>
      </header>
      <section className={`section ${styles.body}`}>
        <div className="wrap">
          <div className={`panel ${styles.panel}`}>
            <StayPicker />
          </div>
          <p className={styles.fine}>Every submission is checked before it counts. Aggregates appear on a hotel page once it has five approved stays.</p>
        </div>
      </section>
    </>
  )
}
