import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { signOut } from '@/auth'
import { DeleteAccountForm } from '@/components/DeleteAccountForm'
import { DisplayNameForm } from '@/components/DisplayNameForm'
import { TiersForm, type ProgramTiers } from '@/components/TiersForm'
import { WithdrawButton } from '@/components/WithdrawButton'
import { type ActivityItem, type ActivityKind, activityTotals, readerActivity, readerStats } from '@/lib/activity'
import { formatRenameDate, renameAvailableAt } from '@/lib/displayName'
import { shortDate } from '@/lib/format'
import { getPayloadClient } from '@/lib/payload'
import { currentReader } from '@/lib/reader'

import styles from './page.module.css'

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

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

const STATE = {
  approved: { label: 'Published', className: 'stOk' },
  pending: { label: 'Waiting to be read', className: 'stWait' },
  rejected: { label: 'Not published', className: 'stNo' },
} as const

// One sent thing: when, what, the detail, and where it stands (mockup: account.html, .acts).
function ActivityRow({ item }: { item: ActivityItem }) {
  const state = STATE[item.status]
  return (
    <li>
      <div>
        <p className="meta">Sent {shortDate(item.createdAt)}</p>
        <h3>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h3>
        {item.detail && <p className={styles.detail}>{item.detail}</p>}
      </div>
      <div className={styles.state}>
        <p className={`${styles.st} ${styles[state.className]}`}>{state.label}</p>
        {item.status === 'pending' && <WithdrawButton kind={item.kind} id={item.id} />}
      </div>
    </li>
  )
}

// Your account (mockups: account.html, account-new.html for a first visit, account-close.html
// with the closing form open): your figures in the band, what you sent on the left, every
// setting on the right.
export default async function AccountPage() {
  const reader = await currentReader()
  if (!reader) redirect('/login?next=/account')

  const [items, stats, programs] = await Promise.all([readerActivity(reader.id), readerStats(reader.id), programTiers(reader.tiers)])
  const totals = activityTotals(items)
  const renameAt = renameAvailableAt(reader.displayNameChangedAt)
  const shownAs = `Shown as ${reader.displayName ?? 'Reader'}`
  const of = (kind: ActivityKind) => items.filter((i) => i.kind === kind)

  const figures = stats
    ? [
        { n: stats.upgradeRate, label: 'Got an upgrade', of: stats.stays },
        { n: stats.suiteRate, label: 'Got a suite', of: stats.stays },
        { n: stats.suiteNoCertRate, label: 'Suite without a certificate', of: stats.stays - stats.certStays },
      ].filter((f) => f.n !== null)
    : []
  const staysWord = (n: number) => `${n} ${n === 1 ? 'stay' : 'stays'}`

  const sections: { kind: ActivityKind; title: string; aside: string; empty: ReactNode; note?: ReactNode }[] = [
    {
      kind: 'stay',
      title: 'Stays',
      aside: 'Always anonymous',
      empty: 'No stays yet. Stays are anonymous, signed in or not.',
      note: (
        <>
          Each stay records the tier you held on it.{' '}
          <Link className="link" href="/submit-a-stay">
            Add your stay
          </Link>
        </>
      ),
    },
    { kind: 'rating', title: 'Lounge ratings', aside: shownAs, empty: "No lounge ratings yet. Ratings go on each lounge's page, and each is read before it appears." },
    { kind: 'comment', title: 'Comments', aside: shownAs, empty: 'No comments yet. Comments go under reviews, articles and lounges, and each is read before it appears.' },
  ]

  return (
    <>
      <section className={`band page-band ${styles.band}`}>
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>{reader.displayName ? `Hello, ${reader.displayName}` : 'Pick a display name'}</h1>
              <p className="pb-dek">
                {totals.total === 0
                  ? 'Nothing submitted yet. Report a stay from any hotel page, or rate a club lounge you have sat in.'
                  : `${totals.total} ${totals.total === 1 ? 'submission' : 'submissions'}, ${totals.approved} published${totals.pending ? `, ${totals.pending} waiting to be read` : ''}.`}
              </p>
              {stats && (
                <p className="pb-meta">
                  {staysWord(stats.stays)} across {stats.hotels} {stats.hotels === 1 ? 'hotel' : 'hotels'}
                  {stats.latest ? `, most recently in ${stats.latest}` : ''}.
                </p>
              )}
            </div>
            {figures.length > 0 && stats && (
              <div className="figs">
                {figures.map((f) => (
                  <div className="fig" key={f.label}>
                    <p className="fig-n">{f.n}%</p>
                    <p className="fig-l">{f.label}</p>
                    <p className="fig-s">of {staysWord(f.of)}</p>
                  </div>
                ))}
                <p className="figs-foot">
                  Your published stays only, counted the way every hotel page counts them
                  {stats.certStays > 0 ? `. ${stats.certStays} used a suite certificate` : ''}.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className={`wrap main ${styles.main} ${items.length === 0 ? styles.first : ''}`}>
        <div className={`grid-side ${styles.grid}`}>
          <div className={styles.col}>
            {items.length === 0 ? (
              <section className="mod">
                <div className="mod-head">
                  <h2>Your activity</h2>
                </div>
                <p className={styles.empty}>
                  Stays are always anonymous. Comments and lounge ratings carry your display name{reader.displayName ? '' : ' once you have picked one'}.{' '}
                  <Link className="link" href="/submit-a-stay">
                    Report a stay
                  </Link>
                  .
                </p>
              </section>
            ) : (
              sections.map((s) => {
                const rows = of(s.kind)
                return (
                  <section className="mod" key={s.kind}>
                    <div className="mod-head">
                      <h2>{s.title}</h2>
                      <span className="aside">{s.aside}</span>
                    </div>
                    {rows.length ? (
                      <ol className={styles.acts}>
                        {rows.map((item) => (
                          <ActivityRow key={`${item.kind}-${item.id}`} item={item} />
                        ))}
                      </ol>
                    ) : (
                      <p className={styles.empty}>{s.empty}</p>
                    )}
                    {s.note && <p className="mod-note">{s.note}</p>}
                  </section>
                )
              })
            )}
          </div>

          <aside className={styles.side}>
            <section className="box">
              <h2>Display name</h2>
              {renameAt ? (
                <>
                  <p className={styles.name}>{reader.displayName}</p>
                  <p className="help">
                    Names can be changed once every six months, so that a name people recognise stays attached to the same person. You can change yours again
                    on {formatRenameDate(renameAt)}.
                  </p>
                </>
              ) : (
                <>
                  <DisplayNameForm current={reader.displayName} />
                  <p className="help">
                    {reader.displayName
                      ? 'Changing it now fixes it for six months. It appears on your comments and lounge ratings. Stays are anonymous either way.'
                      : 'Shown next to your comments and lounge ratings. Stays are always anonymous. You can change it later.'}
                  </p>
                </>
              )}
              {reader.blocked && (
                <p className={`form-alert ${styles.blocked}`} role="status">
                  Posting from this account is paused. Ratings and comments you submit will not be published.
                </p>
              )}
            </section>

            <section>
              <div className="mod-head thin">
                <h2>Status you hold</h2>
              </div>
              <p className={styles.p}>Fills in the status question when you report a stay. Each stay still records the tier you held on that stay.</p>
              <TiersForm programs={programs} />
            </section>

            <section>
              <div className="mod-head thin">
                <h2>Signed in</h2>
              </div>
              <p className={styles.email}>{reader.email}</p>
              <p className="help">Your email is used to recognise you and is never shown.</p>
              <form
                className={styles.actions}
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button className="btn btn-soft btn-sm" type="submit">
                  Sign out
                </button>
              </form>
            </section>

            <DeleteAccountForm />
          </aside>
        </div>
      </main>
    </>
  )
}
