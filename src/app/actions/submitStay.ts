'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'

import { ALA_CARTE_CAP, BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, LOUNGE_ACCESS, LOUNGE_COMMENT_MAX, LOUNGE_FACTORS, LOUNGE_WORTH_IT, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '@/collections/ReaderStays'
import { getPayloadClient } from '@/lib/payload'
import { currentReader } from '@/lib/reader'

export type SubmitStayState = { ok: true } | { ok: false; error: string } | null

const inList = (v: unknown, list: { value: string }[]) => typeof v === 'string' && list.some((o) => o.value === v)
const DAILY_LIMIT = 10

// Receives the stay form. Everything is validated against the fixed lists
// and the hotel's own program before a pending record is created; the
// public API cannot create reader stays at all.
export async function submitStay(_prev: SubmitStayState, form: FormData): Promise<SubmitStayState> {
  // Honeypot: real people never fill this.
  if (form.get('website')) return { ok: true }

  const hotelId = Number(form.get('hotel'))
  const tierId = Number(form.get('statusHeld'))
  const stayYear = Number(form.get('stayYear'))
  const upgrade = form.get('upgrade')
  const upgradeType = form.get('upgradeType')
  const suiteType = form.get('suiteType')
  const upgradeHow = form.get('upgradeHow')
  const breakfast = form.get('breakfast')
  const alaCarteCap = form.get('alaCarteCap')
  const lateCheckout = form.get('lateCheckout')
  const loungeId = form.get('lounge') ? Number(form.get('lounge')) : null
  const loungeAccess = form.get('loungeAccess')
  const loungeWorthIt = form.get('loungeWorthIt')
  const loungeScores = Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, form.get(`lounge_${f.name}`) ? Number(form.get(`lounge_${f.name}`)) : null]))
  // Plain text only: trim, drop control characters, cap the length.
  const loungeComment = String(form.get('loungeComment') ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
    .slice(0, LOUNGE_COMMENT_MAX)

  const now = new Date()
  if (!Number.isInteger(hotelId) || !Number.isInteger(tierId)) return { ok: false, error: 'Choose a hotel and the status you held.' }
  if (!Number.isInteger(stayYear) || stayYear < now.getFullYear() - 6 || stayYear > now.getFullYear()) return { ok: false, error: 'Choose the year of the stay.' }
  if (!inList(upgrade, UPGRADE_OUTCOMES) || !inList(breakfast, BREAKFAST_OUTCOMES) || !inList(lateCheckout, LATE_CHECKOUT_OUTCOMES)) {
    return { ok: false, error: 'Pick an answer for each of the three questions.' }
  }
  const upgraded = upgrade === 'yes'
  if (upgraded && !inList(upgradeType, UPGRADE_TYPES)) return { ok: false, error: 'Say what kind of upgrade it was.' }
  const award = upgrade === 'award'
  if (((upgraded && upgradeType === 'suite') || award) && !inList(suiteType, SUITE_TYPES)) return { ok: false, error: 'Say which kind of suite.' }
  if (upgraded && !inList(upgradeHow, UPGRADE_HOW)) return { ok: false, error: 'Say whether the upgrade was offered or asked for.' }
  const alaCarte = breakfast === 'full' || breakfast === 'a-la-carte'
  if (alaCarte && !inList(alaCarteCap, ALA_CARTE_CAP)) return { ok: false, error: 'Say whether the à la carte was capped.' }

  const reader = await currentReader().catch(() => null)
  const payload = await getPayloadClient()
  const hotel = await payload.findByID({ collection: 'hotels', id: hotelId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!hotel || hotel._status !== 'published') return { ok: false, error: 'That hotel is not on the site.' }
  const programId = typeof hotel.program === 'object' ? hotel.program.id : hotel.program
  const tier = await payload.findByID({ collection: 'status-levels', id: tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tierProgram = tier && (typeof tier.program === 'object' ? tier.program.id : tier.program)
  if (!tier || tierProgram !== programId) return { ok: false, error: "That status does not belong to this hotel's program." }

  // Lounge answers only where the lounge belongs to this hotel.
  let lounge: Record<string, string | number | null> | null = null
  if (loungeId) {
    const l = await payload.findByID({ collection: 'lounges', id: loungeId, depth: 0, overrideAccess: true }).catch(() => null)
    const lHotel = l && (typeof l.hotel === 'object' ? l.hotel.id : l.hotel)
    if (!l || lHotel !== hotelId) return { ok: false, error: 'That lounge is not at this hotel.' }
    if (!inList(loungeAccess, LOUNGE_ACCESS)) return { ok: false, error: 'Say whether you got into the lounge.' }
    const used = loungeAccess === 'given'
    for (const f of LOUNGE_FACTORS) {
      const n = loungeScores[f.name]
      if (used && (n == null || !Number.isInteger(n) || n < 1 || n > 5)) return { ok: false, error: `Score the lounge for ${f.label.toLowerCase()}, 1 to 5.` }
    }
    if (used && !inList(loungeWorthIt, LOUNGE_WORTH_IT)) return { ok: false, error: 'Say whether the lounge was worth a club room.' }
    lounge = {
      lounge: loungeId,
      access: loungeAccess as string,
      ...Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, used ? loungeScores[f.name] : null])),
      worthIt: used ? (loungeWorthIt as string) : null,
      comment: reader && !reader.blocked && loungeComment ? loungeComment : null,
    }
  }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  const submitterHash = createHash('sha256').update(`${ip}|${process.env.PAYLOAD_SECRET ?? ''}`).digest('hex').slice(0, 32)

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await payload.count({ collection: 'reader-stays', where: { and: [{ submitterHash: { equals: submitterHash } }, { createdAt: { greater_than: since } }] }, overrideAccess: true })
  if (recent.totalDocs >= DAILY_LIMIT) return { ok: false, error: 'That is plenty for one day. Thank you.' }

  const duplicate = await payload.count({
    collection: 'reader-stays',
    where: { and: [{ submitterHash: { equals: submitterHash } }, { hotel: { equals: hotelId } }, { stayYear: { equals: stayYear } }] },
    overrideAccess: true,
  })
  if (duplicate.totalDocs > 0) return { ok: true }

  await payload.create({
    collection: 'reader-stays',
    overrideAccess: true,
    data: {
      status: 'pending',
      hotel: hotelId,
      program: programId,
      statusHeld: tierId,
      stayYear,
      upgrade: upgrade as string,
      upgradeType: upgraded ? (upgradeType as string) : null,
      suiteType: (upgraded && upgradeType === 'suite') || award ? (suiteType as string) : null,
      upgradeHow: upgraded ? (upgradeHow as string) : null,
      breakfast: breakfast as string,
      alaCarteCap: alaCarte ? (alaCarteCap as string) : null,
      lateCheckout: lateCheckout as string,
      lounge,
      reader: reader?.id ?? null,
      submitterHash,
    } as never,
  })
  return { ok: true }
}
