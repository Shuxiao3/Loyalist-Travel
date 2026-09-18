import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth, authEnabled, signIn } from '@/auth'

import styles from './page.module.css'

export const metadata: Metadata = { title: 'Sign in', description: 'Sign in to put your name on lounge ratings and comments.', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ next?: string; error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams
  const session = await auth()
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
  if (session?.reader) redirect(target)

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Readers</span>
          <h1 className={styles.h1}>Sign in</h1>
          <p className="sub">A name on your lounge ratings and comments. Stays stay anonymous either way, and nothing here is needed to submit one.</p>
        </div>
      </header>
      <section className={`section ${styles.body}`}>
        <div className="wrap">
          <div className={`panel ${styles.panel}`}>
            {authEnabled ? (
              <>
                <form
                  action={async () => {
                    'use server'
                    await signIn('google', { redirectTo: target })
                  }}
                >
                  <button className={`btn ${styles.google}`} type="submit">
                    <GoogleMark />
                    Continue with Google
                  </button>
                </form>
                {error && <p className={styles.error}>Sign-in did not complete. Try again.</p>}
                <p className={styles.fine}>We keep your email to recognise you and never show it. You pick a display name next.</p>
              </>
            ) : (
              <p className={styles.fine}>Sign-in is not switched on yet. Reader accounts arrive shortly.</p>
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

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.7 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.3 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.8-4.1-13.7-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
