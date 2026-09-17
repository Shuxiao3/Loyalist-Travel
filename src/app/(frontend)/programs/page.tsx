import type { Metadata } from 'next'
import Link from 'next/link'

import { Arrow } from '@/components/Band'
import { count } from '@/lib/format'
import { getPrograms } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Loyalty programs',
  description: 'World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors: elite tiers, what each actually delivers, and every hotel indexed under each.',
}

export default async function ProgramsIndex() {
  const programs = await getPrograms()
  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Loyalty programs</span>
          <h1 className={styles.h1}>Where your points work</h1>
          <p className="sub">Four programs, their elite tiers, and what each tier got us at the front desk. Every hotel on the site is indexed under one of them.</p>
        </div>
      </header>
      <section className={`section ${styles.list}`}>
        <div className="wrap">
          <div className="grid-cells">
            {programs.map(({ program, hotels, scored }) => (
              <Link className={`cell ${styles.prog}`} href={`/programs/${program.slug}`} key={program.id}>
                <span className="label">Program</span>
                <h3>
                  {program.name}
                  <Arrow size={16} />
                </h3>
                {program.shortDescription && <span className={styles.desc}>{program.shortDescription}</span>}
                <span className={styles.n}>
                  {hotels > 0 ? (
                    <>
                      <b>{count(hotels)}</b> hotels indexed · <b>{count(scored)}</b> scored {scored === 1 ? 'stay' : 'stays'}
                    </>
                  ) : (
                    'Coming soon'
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
