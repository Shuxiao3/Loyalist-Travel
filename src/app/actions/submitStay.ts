'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'

import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, UPGRADE_OUTCOMES } from '@/collections/ReaderStays'
import { getPayloadClient } from '@/lib/payload'

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
  const stayMonth = Number(form.get('stayMonth'))
  const upgrade = form.get('upgrade')
  const breakfast = form.get('breakfast')
  const lateCheckout = form.get('lateCheckout')

  const now = new Date()
  if (!Number.isInteger(hotelId) || !Number.isInteger(tierId)) return { ok: false, error: 'Choose a hotel and the status you held.' }
  if (!Number.isInteger(stayYear) || stayYear < now.getFullYear() - 6 || stayYear > now.getFullYear()) return { ok: false, error: 'Choose the year of the stay.' }
  if (!Number.isInteger(stayMonth) || stayMonth < 1 || stayMonth > 12) return { ok: false, error: 'Choose the month of the stay.' }
  if (stayYear === now.getFullYear() && stayMonth > now.getMonth() + 1) return { ok: false, error: 'That month has not happened yet.' }
  if (!inList(upgrade, UPGRADE_OUTCOMES) || !inList(breakfast, BREAKFAST_OUTCOMES) || !inList(lateCheckout, LATE_CHECKOUT_OUTCOMES)) {
    return { ok: false, error: 'Pick an answer for each of the three questions.' }
  }

  const payload = await getPayloadClient()
  const hotel = await payload.findByID({ collection: 'hotels', id: hotelId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!hotel || hotel._status !== 'published') return { ok: false, error: 'That hotel is not on the site.' }
  const programId = typeof hotel.program === 'object' ? hotel.program.id : hotel.program
  const tier = await payload.findByID({ collection: 'status-levels', id: tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tierProgram = tier && (typeof tier.program === 'object' ? tier.program.id : tier.program)
  if (!tier || tierProgram !== programId) return { ok: false, error: "That status does not belong to this hotel's program." }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  const submitterHash = createHash('sha256').update(`${ip}|${process.env.PAYLOAD_SECRET ?? ''}`).digest('hex').slice(0, 32)

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await payload.count({ collection: 'reader-stays', where: { and: [{ submitterHash: { equals: submitterHash } }, { createdAt: { greater_than: since } }] }, overrideAccess: true })
  if (recent.totalDocs >= DAILY_LIMIT) return { ok: false, error: 'That is plenty for one day. Thank you.' }

  const duplicate = await payload.count({
    collection: 'reader-stays',
    where: { and: [{ submitterHash: { equals: submitterHash } }, { hotel: { equals: hotelId } }, { stayYear: { equals: stayYear } }, { stayMonth: { equals: stayMonth } }] },
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
      stayMonth,
      upgrade: upgrade as string,
      breakfast: breakfast as string,
      lateCheckout: lateCheckout as string,
      submitterHash,
    } as never,
  })
  return { ok: true }
}
