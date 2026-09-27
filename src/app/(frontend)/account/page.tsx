import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/auth'
import { DeleteAccountForm } from '@/components/DeleteAccountForm'
import { DisplayNameForm } from '@/components/DisplayNameForm'
import { TiersForm, type ProgramTiers } from '@/components/TiersForm'
import { WithdrawButton } from '@/components/WithdrawButton'
import { activityTotals, kindLabel, readerActivity, readerStats } from '@/lib/activity'
import { formatRenameDate, renameAvailableAt } from '@/lib/displayName'
import { getPayloadClient } from '@/lib/payload'
import { currentReader } from '@/lib/reader'

import styles from './page.module.css'

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Every programme with its tiers, and which one this reader says they hold. */
async function programTiers(held: number[]): Promise<ProgramTiers[]> {
  const payload = await getPayloadClient()
  const [programs, levels] = await Promise.all([
    payload.find({ collection: 'programs', limit: 50, depth: 0, overrideAccess: true, sort: 'name' }),
    payload.find({ collection: 'status-levels', limit: 200, depth: 0, overrideAccess: true, sort: 'rank' }),
  ])
  const heldSet = new Set(held)
  return programs.docs.map((program) => {
    const tiers = levels.docs.filter((l) => (typeof l.program === 'object' && l.program ? l.program.id : l.program) === program.id)
    return {
      id: program.id,
      name: program.name,
      tiers: tiers.map((t) => ({ id: t.id, label: t.shortName ?? t.name })),
      current: tiers.find((t) => heldSet.has(t.id))?.id ?? null,
    }
  })
}

export default async function AccountPage() {
  const reader = await currentReader()
  if (!reader) redirect('/login?next=/account')

  const [items, stats, programs] = await Promise.all([readerActivity(reader.id), readerStats(reader.id), programTiers(reader.tiers)])
  const totals = activityTotals(items)
  const renameAt = renameAvailableAt(reader.displayNameChangedAt)

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Readers</span>
          <h1 className={styles.h1}>{reader.displayName ? `Hello, ${reader.displayName}` : 'Pick a display name'}</h1>
          <p className="sub">
            {totals.total === 0
              ? 'Nothing submitted yet. Report a stay from any hotel page, or rate a club lounge you have sat in.'
              : `${totals.total} ${totals.total === 1 ? 'submission' : 'submissions'}, ${totals.approved} published${totals.pending ? `, ${totals.pending} waiting to be read` : ''}.`}
          </p>
        </div>
      </header>

      <section className={`section ${styles.body}`}>
        <div className={`wrap ${styles.grid}`}>
          <div className={styles.main}>
            {stats && (
              <div className={styles.stats}>
                <span className="eyebrow">Your record</span>
                <p className={styles.statLine}>
                  <strong>{stats.stays}</strong> {stats.stays === 1 ? 'stay' : 'stays'} across <strong>{stats.hotels}</strong>{' '}
                  {stats.hotels === 1 ? 'hotel' : 'hotels'}
                  {stats.latest ? `, most recently in ${stats.latest}` : ''}.
                </p>
                <dl className={styles.figures}>
                  {stats.upgradeRate !== null && (
                    <div>
                      <dt>Upgraded</dt>
                      <dd>{stats.upgradeRate}%</dd>
                    </div>
                  )}
                  {stats.suiteRate !== null && (
                    <div>
                      <dt>To a suite</dt>
                      <dd>{stats.suiteRate}%</dd>
                    </div>
                  )}
                  {stats.breakfastRate !== null && (
                    <div>
                      <dt>Breakfast honoured</dt>
                      <dd>{stats.breakfastRate}%</dd>
                    </div>
                  )}
                  {stats.lateCheckoutRate !== null && (
                    <div>
                      <dt>Late checkout</dt>
                      <dd>{stats.lateCheckoutRate}%</dd>
                    </div>
                  )}
                </dl>
                <p className={styles.statFine}>
                  Your published stays only, counted the way every hotel page counts them
                  {stats.awardStays > 0 ? `. ${stats.awardStays} suite ${stats.awardStays === 1 ? 'award is' : 'awards are'} left out of the upgrade rates` : ''}.
                </p>
              </div>
            )}

            <span className="eyebrow">Your activity</span>
            {items.length === 0 ? (
              <p className={styles.empty}>
                Stays are always anonymous. Comments and lounge ratings carry your display name once you have picked one.{' '}
                <Link href="/submit-a-stay">Report a stay</Link>.
              </p>
            ) : (
              <ul className={styles.items}>
                {items.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className={styles.item}>
                    <div className={styles.itemHead}>
                      <span className={styles.kind}>{kindLabel(item.kind)}</span>
                      <span className={`${styles.status} ${styles[item.status]}`}>
                        {item.status === 'approved' ? 'Published' : item.status === 'pending' ? 'Waiting to be read' : 'Not published'}
                      </span>
                      <span className={styles.date}>{when(item.createdAt)}</span>
                    </div>
                    <p className={styles.title}>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</p>
                    {item.detail && <p className={styles.detail}>{item.detail}</p>}
                    {item.status === 'pending' && <WithdrawButton kind={item.kind} id={item.id} />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.side}>
            <div className={`panel ${styles.panel}`}>
              <span className="eyebrow">Display name</span>
              {renameAt ? (
                <>
                  <p className={styles.name}>{reader.displayName}</p>
                  <p className={styles.panelFine}>
                    Names can be changed once every six months, so that a name people recognise stays attached to the same person. You can change
                    yours again on {formatRenameDate(renameAt)}.
                  </p>
                </>
              ) : (
                <>
                  <DisplayNameForm current={reader.displayName} />
                  <p className={styles.panelFine}>
                    {reader.displayName
                      ? 'Changing it now fixes it for six months. It appears on your comments and lounge ratings; stays stay anonymous.'
                      : 'Shown next to your comments and lounge ratings. Stays are always anonymous. You can change it later.'}
                  </p>
                </>
              )}
              {reader.blocked && <p className={styles.blocked}>Posting from this account is paused. Ratings and comments you submit will not be published.</p>}
            </div>

            <div className={styles.block}>
              <span className="eyebrow on-light">Status you hold</span>
              <p className={styles.fine}>Fills in the status question when you report a stay. Each stay still records the tier you held on that stay.</p>
              <TiersForm programs={programs} />
            </div>

            <div className={styles.block}>
              <span className="eyebrow on-light">Signed in</span>
              <p className={styles.email}>{reader.email}</p>
              <p className={styles.fine}>Your email is used to recognise you and is never shown.</p>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button className="ghost" type="submit">
                  Sign out
                </button>
              </form>
              <div className={styles.danger}>
                <DeleteAccountForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
