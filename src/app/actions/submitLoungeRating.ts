'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'

import { getPayloadClient } from '@/lib/payload'
import { currentReader } from '@/lib/reader'
import { LOUNGE_ACCESS, LOUNGE_COMMENT_MAX, LOUNGE_FACTORS, LOUNGE_WORTH_IT } from '@/lib/stayOptions'
import { TURNSTILE_FIELD, verifyTurnstile } from '@/lib/turnstile'

export type LoungeRatingState = { ok: boolean; error?: string } | null

const DAILY_LIMIT = 10
const inList = (v: unknown, list: { value: string }[]) => typeof v === 'string' && list.some((o) => o.value === v)

// A lounge rating from the lounge page. Validates every answer, attaches
// the signed-in reader if any, and files it as pending.
export async function submitLoungeRating(prev: LoungeRatingState, form: FormData): Promise<LoungeRatingState> {
  if (form.get('website')) return { ok: true } // honeypot

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  if (!(await verifyTurnstile(form.get(TURNSTILE_FIELD), ip))) return { ok: false, error: 'The check did not pass. Try once more.' }

  const loungeId = Number(form.get('lounge'))
  const tierId = Number(form.get('statusHeld'))
  const stayYear = Number(form.get('stayYear'))
  const access = form.get('access')
  const worthIt = form.get('worthIt')
  const scores = Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, form.get(f.name) ? Number(form.get(f.name)) : null]))
  const comment = String(form.get('comment') ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
    .slice(0, LOUNGE_COMMENT_MAX)

  const now = new Date()
  if (!Number.isInteger(loungeId) || !Number.isInteger(tierId)) return { ok: false, error: 'Choose the status you held.' }
  if (!Number.isInteger(stayYear) || stayYear < now.getFullYear() - 6 || stayYear > now.getFullYear()) return { ok: false, error: 'Choose the year of the stay.' }
  if (!inList(access, LOUNGE_ACCESS)) return { ok: false, error: 'Say whether you got into the lounge.' }
  const used = access === 'given'
  for (const f of LOUNGE_FACTORS) {
    const n = scores[f.name]
    if (used && (n == null || !Number.isInteger(n) || n < 1 || n > 5)) return { ok: false, error: `Score ${f.label.toLowerCase()}, 1 to 5.` }
  }
  if (used && !inList(worthIt, LOUNGE_WORTH_IT)) return { ok: false, error: 'Say whether it was worth a club room.' }

  const payload = await getPayloadClient()
  const lounge = await payload.findByID({ collection: 'lounges', id: loungeId, depth: 1, overrideAccess: true }).catch(() => null)
  if (!lounge || lounge._status !== 'published') return { ok: false, error: 'That lounge is not on the site.' }
  const hotel = typeof lounge.hotel === 'object' ? lounge.hotel : null
  const programId = hotel ? (typeof hotel.program === 'object' ? hotel.program.id : hotel.program) : null
  const tier = await payload.findByID({ collection: 'status-levels', id: tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tierProgram = tier && (typeof tier.program === 'object' ? tier.program.id : tier.program)
  if (!tier || tierProgram !== programId) return { ok: false, error: "That status does not belong to this hotel's program." }

  const reader = await currentReader().catch(() => null)
  const submitterHash = createHash('sha256').update(`${ip}|${process.env.PAYLOAD_SECRET ?? ''}`).digest('hex').slice(0, 32)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await payload.count({ collection: 'lounge-ratings', where: { and: [{ submitterHash: { equals: submitterHash } }, { createdAt: { greater_than: since } }] }, overrideAccess: true })
  if (recent.totalDocs >= DAILY_LIMIT) return { ok: false, error: 'That is plenty for one day. Thank you.' }
  const duplicate = await payload.count({ collection: 'lounge-ratings', where: { and: [{ submitterHash: { equals: submitterHash } }, { lounge: { equals: loungeId } }, { stayYear: { equals: stayYear } }] }, overrideAccess: true })
  if (duplicate.totalDocs > 0) return { ok: true }

  await payload.create({
    collection: 'lounge-ratings',
    overrideAccess: true,
    data: {
      status: 'pending',
      lounge: loungeId,
      statusHeld: tierId,
      stayYear,
      access: access as string,
      ...Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, used ? scores[f.name] : null])),
      worthIt: used ? (worthIt as string) : null,
      comment: reader && !reader.blocked && comment ? comment : null,
      reader: reader?.id ?? null,
      submitterHash,
    } as never,
  })
  return { ok: true }
}
