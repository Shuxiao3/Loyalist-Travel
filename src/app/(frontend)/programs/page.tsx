import type { Metadata } from 'next'
import Link from 'next/link'

import { Arrow } from '@/components/Band'
import { LandingHero } from '@/components/LandingHero'
import { count, mediaUrl } from '@/lib/format'
import { getPrograms } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Loyalty programs',
  description: 'World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors: elite tiers, what each actually delivers, and every hotel indexed under each.',
}

export default async function ProgramsIndex() {
  const programs = await getPrograms()
  const spotlight = [...programs].sort((a, b) => b.scored - a.scored || b.hotels - a.hotels)[0]
  return (
    <>
      <LandingHero
        eyebrow="Loyalty programs"
        title="Where your points work"
        text="Four programs, their elite tiers, and what each tier got us at the front desk. Every hotel on the site is indexed under one of them."
        photo={spotlight?.program.images?.heroImageUrl}
        card={
          spotlight
            ? {
                eyebrow: 'Most reviewed',
                image: spotlight.program.images?.heroImageUrl ?? null,
                meta: [`${count(spotlight.hotels)} hotels`, `${count(spotlight.scored)} scored ${spotlight.scored === 1 ? 'stay' : 'stays'}`],
                title: spotlight.program.name,
                figure: spotlight.program.topTierName ? { value: spotlight.program.topTierName, label: 'top tier' } : null,
                cta: 'See the program',
                href: `/programs/${spotlight.program.slug}`,
              }
            : null
        }
      />
      <section className={`section ${styles.list}`}>
        <div className="wrap">
          <div className="grid-cells">
            {programs.map(({ program, hotels, scored }) => (
              <Link className={`cell ${styles.prog}`} href={`/programs/${program.slug}`} key={program.id}>
                <span className={styles.top}>
                  <span className="label">Program</span>
                  <Arrow size={16} />
                </span>
                <h3 className={styles.name}>
                  {mediaUrl(program.logo) ?? program.images?.logoUrl ? (
                    <>
                      <span className={styles.logoBox}>
                        <img className={styles.logo} src={(mediaUrl(program.logo) ?? program.images?.logoUrl)!} alt={program.name} />
                      </span>
                      <span className="sr-only">{program.name}</span>
                    </>
                  ) : (
                    program.name
                  )}
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
