// Transactional email. One function, over Resend's HTTP API, so there is no
// SMTP library in the bundle and nothing to configure beyond two variables.
//
// To send through Postmark, SES or anything else instead, replace the body of
// sendEmail: everything above it only needs { to, subject, text, html }.

export const emailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export type Email = { to: string; subject: string; text: string; html: string }

export async function sendEmail({ to, subject, text, html }: Email): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) return { ok: false, error: 'Email is not configured.' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    })
    if (!res.ok) {
      // Log the reason for us; the caller never shows it to the reader, because
      // a provider's message can say whether an address exists.
      console.error(`sendEmail: ${res.status} ${await res.text().catch(() => '')}`)
      return { ok: false, error: 'The email could not be sent.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('sendEmail:', err)
    return { ok: false, error: 'The email could not be sent.' }
  }
}

/** The sign-in link email. Plain text first; the HTML is the same words. */
export function signInEmail(url: string, minutes: number): Omit<Email, 'to'> {
  return {
    subject: 'Your Loyalist Travel sign-in link',
    text: [
      'Use this link to sign in to Loyalist Travel:',
      '',
      url,
      '',
      `It works once, and for ${minutes} minutes.`,
      'If you did not ask to sign in, you can ignore this email — nobody can get in without the link.',
    ].join('\n'),
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:32px">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5">Use this link to sign in to Loyalist Travel:</p>
    <p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-size:15px">Sign in</a></p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#555">It works once, and for ${minutes} minutes.</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#555">If you did not ask to sign in, you can ignore this email — nobody can get in without the link.</p>
  </div>
</body></html>`,
  }
}
