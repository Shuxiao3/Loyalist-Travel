import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/auth'
import { DisplayNameForm } from '@/components/DisplayNameForm'
import { activityTotals, kindLabel, readerActivity } from '@/lib/activity'
import { formatRenameDate, renameAvailableAt } from '@/lib/displayName'
import { currentReader } from '@/lib/reader'

import styles from './page.module.css'

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const DAY = 'numeric' as const

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: DAY, month: 'short', year: 'numeric' })
}

export default async function AccountPage() {
  const reader = await currentReader()
  if (!reader) redirect('/login?next=/account')

  const items = await readerActivity(reader.id)
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

            <div className={styles.signed}>
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
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
