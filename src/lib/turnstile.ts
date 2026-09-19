// Cloudflare Turnstile, the captcha on the public forms. Off until both keys
// exist, so local and preview builds keep working without it. The site key
// is public by design and is inlined into the browser bundle by Next.
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
export const turnstileEnabled = Boolean(turnstileSiteKey && process.env.TURNSTILE_SECRET_KEY)

// The field name the Turnstile widget writes its token into.
export const TURNSTILE_FIELD = 'cf-turnstile-response'

// Asks Cloudflare whether a token from the widget is genuine. A missing or
// reused token fails. Network trouble on Cloudflare's side also fails closed:
// better a retry than a wide-open form.
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  if (!turnstileEnabled) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip === 'unknown' ? undefined : ip }),
      cache: 'no-store',
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
