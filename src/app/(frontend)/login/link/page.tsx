import type { Metadata } from 'next'
import Link from 'next/link'

import { signIn } from '@/auth'

import styles from '../page.module.css'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ token?: string; next?: string }> }

/**
 * Where an emailed sign-in link lands. It asks for one click rather than
 * signing the reader straight in, for two reasons: a page cannot set a session
 * cookie, only an action can; and mail scanners, link previewers and corporate
 * antivirus all follow links in email, which would spend a single-use token
 * before the reader ever saw it.
 *
 * Laid out like the sign-in page (mockup: login.html): the band, then one card.
 */
export default async function LinkPage({ searchParams }: Props) {
  const { token, next } = await searchParams
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>{token ? 'Finish signing in' : 'That link is incomplete'}</h1>
              <p className="pb-dek">{token ? 'One click and you are in. The link works once.' : 'Ask for a new one and it will be in your inbox in a moment.'}</p>
            </div>
          </div>
        </div>
      </section>

      <main className={`wrap main ${styles.main}`}>
        <div className={`grid-side ${styles.grid}`}>
          <section className={styles.card}>
            {token ? (
              <>
                <h2 className="h2">Sign in</h2>
                <p className={styles.lede}>This signs you in on this device.</p>
                <form
                  className={styles.actions}
                  action={async () => {
                    'use server'
                    // Auth.js redirects on success. On a spent, wrong or expired
                    // token it sends the reader to the error page, which is
                    // /login, where they can ask for another.
                    await signIn('email-link', { token, redirectTo: target })
                  }}
                >
                  <button className="btn" type="submit">
                    Sign in
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="h2">Sign in</h2>
                <p className={styles.lede}>Part of the address is missing, so it cannot sign you in. A new link comes from the sign-in page.</p>
                <p className={styles.actions}>
                  <Link className="btn" href="/login">
                    Ask for a new link
                  </Link>
                </p>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
