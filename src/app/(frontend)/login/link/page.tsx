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
 */
export default async function LinkPage({ searchParams }: Props) {
  const { token, next } = await searchParams
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Readers</span>
          <h1 className={styles.h1}>{token ? 'Finish signing in' : 'That link is incomplete'}</h1>
          <p className="sub">{token ? 'One click and you are in. The link works once.' : 'Ask for a new one and it will be in your inbox in a moment.'}</p>
        </div>
      </header>
      <section className={`section ${styles.body}`}>
        <div className="wrap">
          <div className={`panel ${styles.panel}`}>
            {token ? (
              <form
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
            ) : (
              <p className={styles.fine}>
                <Link href="/login">Ask for a new link</Link>
              </p>
            )}
          </div>
          <p className={styles.back}>
            <Link href="/">Back to the site</Link>
          </p>
        </div>
      </section>
    </>
  )
}
