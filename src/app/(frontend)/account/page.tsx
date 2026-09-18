import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { signOut } from '@/auth'
import { DisplayNameForm } from '@/components/DisplayNameForm'
import { currentReader } from '@/lib/reader'

import styles from './page.module.css'

export const metadata: Metadata = { title: 'Your account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const reader = await currentReader()
  if (!reader) redirect('/login?next=/account')

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Readers</span>
          <h1 className={styles.h1}>{reader.displayName ? `Hello, ${reader.displayName}` : 'Pick a display name'}</h1>
          <p className="sub">{reader.displayName ? 'Your name appears on lounge ratings and comments you post while signed in. Stays are always anonymous.' : 'This is the name shown next to your lounge ratings and comments. You can change it later.'}</p>
        </div>
      </header>
      <section className={`section ${styles.body}`}>
        <div className={`wrap ${styles.grid}`}>
          <div className={`panel ${styles.panel}`}>
            <span className="eyebrow">Display name</span>
            <DisplayNameForm current={reader.displayName} />
            {reader.blocked && <p className={styles.blocked}>Posting from this account is paused. Ratings and comments you submit will not be published.</p>}
          </div>
          <div className={styles.side}>
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
      </section>
    </>
  )
}
