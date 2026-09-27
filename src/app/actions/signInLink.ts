'use server'

import { SITE_URL } from '@/lib/seo'
import { sendEmail, signInEmail } from '@/lib/email'
import { createSignInToken, TOKEN_MINUTES, looksLikeEmail, normaliseEmail } from '@/lib/signInToken'

export type LinkState = { sent?: boolean; error?: string } | null

/**
 * Emails a single-use sign-in link.
 *
 * Says the same thing whether or not the address belongs to a reader: this form
 * is public, and a different answer per address would turn it into a way to ask
 * whether someone has an account here.
 */
export async function requestSignInLink(prev: LinkState, formData: FormData): Promise<LinkState> {
  const email = normaliseEmail(String(formData.get('email') ?? ''))
  if (!looksLikeEmail(email)) return { error: 'That does not look like an email address.' }

  const next = String(formData.get('next') ?? '')
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  try {
    const token = await createSignInToken(email)
    const url = `${SITE_URL}/login/link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(target)}`
    const sent = await sendEmail({ to: email, ...signInEmail(url, TOKEN_MINUTES) })
    // A send failure is ours, not theirs, and saying so beats a reader waiting
    // for an email that was never going to arrive.
    if (!sent.ok) return { error: 'We could not send the email just now. Try again in a minute.' }
  } catch (err) {
    console.error('requestSignInLink:', err)
    return { error: 'We could not send the email just now. Try again in a minute.' }
  }

  return { sent: true }
}
