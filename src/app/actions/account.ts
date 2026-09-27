'use server'

import { revalidatePath } from 'next/cache'

import { signOut } from '@/auth'
import { checkDisplayName, formatRenameDate, renameAvailableAt } from '@/lib/displayName'
import { currentReader } from '@/lib/reader'
import { getPayloadClient } from '@/lib/payload'

export type AccountState = { ok: boolean; error?: string } | null

export async function saveDisplayName(prev: AccountState, formData: FormData): Promise<AccountState> {
  const reader = await currentReader()
  if (!reader) return { ok: false, error: 'Sign in first.' }
  const check = checkDisplayName(String(formData.get('displayName') ?? ''))
  if (!check.ok) return { ok: false, error: check.error }

  // Resubmitting the name they already have is not a change, and must not spend
  // the next six months' allowance.
  if (check.name === reader.displayName) return { ok: true }

  const blockedUntil = renameAvailableAt(reader.displayNameChangedAt)
  if (blockedUntil) return { ok: false, error: `Names can be changed once every six months. You can change yours again on ${formatRenameDate(blockedUntil)}.` }

  const payload = await getPayloadClient()
  const taken = await payload.find({ collection: 'readers', where: { and: [{ displayName: { equals: check.name } }, { id: { not_equals: reader.id } }] }, limit: 1, depth: 0, overrideAccess: true })
  if (taken.docs[0]) return { ok: false, error: 'That name is taken.' }

  await payload.update({
    collection: 'readers',
    id: reader.id,
    // Only a change starts the clock; the first pick leaves it null.
    data: { displayName: check.name, ...(reader.displayName ? { displayNameChangedAt: new Date().toISOString() } : {}) },
    overrideAccess: true,
    depth: 0,
  })
  revalidatePath('/account')
  return { ok: true }
}

export type WithdrawState = { ok: boolean; error?: string } | null

const WITHDRAWABLE = { stay: 'reader-stays', comment: 'comments', rating: 'lounge-ratings' } as const
type Withdrawable = keyof typeof WITHDRAWABLE

/**
 * Removes a submission the reader has sent but nobody has read yet.
 *
 * Only while it is pending, and only their own: once something is published it
 * is part of a hotel's figures or a page's comments, and taking it back is a
 * conversation with an editor rather than a button. Ownership and status are
 * both re-checked here — the id came from a form and means nothing on its own.
 */
export async function withdrawSubmission(prev: WithdrawState, formData: FormData): Promise<WithdrawState> {
  const reader = await currentReader()
  if (!reader) return { ok: false, error: 'Sign in first.' }

  const kind = String(formData.get('kind') ?? '') as Withdrawable
  const id = Number(formData.get('id'))
  const collection = WITHDRAWABLE[kind]
  if (!collection || !Number.isInteger(id)) return { ok: false, error: 'That is not something you can withdraw.' }

  const payload = await getPayloadClient()
  const found = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!found) return { ok: false, error: 'It is not there any more.' }

  const owner = typeof found.reader === 'object' && found.reader ? found.reader.id : found.reader
  if (owner !== reader.id) return { ok: false, error: 'That is not yours.' }
  if (found.status !== 'pending') return { ok: false, error: 'It has already been read, so it cannot be withdrawn here. Ask us and we will take it down.' }

  await payload.delete({ collection, id, overrideAccess: true })
  revalidatePath('/account')
  return { ok: true }
}

export type TiersState = { ok: boolean; error?: string } | null

/**
 * The tiers a reader holds, at most one per programme.
 *
 * Only ever used to prefill the status question on the stay form. Each stay
 * still records the tier held on that stay, because status changes and last
 * year's stay was not made as this year's Globalist.
 */
export async function saveTiers(prev: TiersState, formData: FormData): Promise<TiersState> {
  const reader = await currentReader()
  if (!reader) return { ok: false, error: 'Sign in first.' }

  const payload = await getPayloadClient()
  const programs = await payload.find({ collection: 'programs', limit: 50, depth: 0, overrideAccess: true })

  // One select per programme, named tier-<programId>. An empty value means no
  // status in that programme, which is a real answer and the default.
  const picked: number[] = []
  for (const program of programs.docs) {
    const raw = String(formData.get(`tier-${program.id}`) ?? '')
    if (!raw) continue
    const id = Number(raw)
    if (!Number.isInteger(id)) continue
    // Confirm the tier exists and belongs to the programme it was offered under,
    // so a rewritten form cannot attach an arbitrary tier.
    const tier = await payload.findByID({ collection: 'status-levels', id, depth: 0, overrideAccess: true }).catch(() => null)
    const owner = tier && typeof tier.program === 'object' && tier.program ? tier.program.id : tier?.program
    if (tier && owner === program.id) picked.push(id)
  }

  await payload.update({ collection: 'readers', id: reader.id, data: { tiers: picked }, overrideAccess: true, depth: 0 })
  revalidatePath('/account')
  return { ok: true }
}

export type DeleteState = { ok: boolean; error?: string } | null

/**
 * Closes the account and detaches everything it submitted.
 *
 * Stays, comments and lounge ratings are kept and unlinked, not deleted: the
 * upgrade rates and lounge scores the site is built on do not move because
 * someone left. A comment with no reader shows as "Reader". The reader row, and
 * with it the email address, is gone.
 */
export async function deleteAccount(prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const reader = await currentReader()
  if (!reader) return { ok: false, error: 'Sign in first.' }
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== 'delete') {
    return { ok: false, error: 'Type delete to confirm.' }
  }

  const payload = await getPayloadClient()
  const where = { reader: { equals: reader.id } }
  for (const collection of ['reader-stays', 'comments', 'lounge-ratings'] as const) {
    await payload.update({ collection, where, data: { reader: null }, overrideAccess: true, depth: 0 })
  }
  await payload.delete({ collection: 'readers', id: reader.id, overrideAccess: true })

  // The session still names a reader that no longer exists; signing out is what
  // clears the cookie. Redirects, so nothing after this runs.
  await signOut({ redirectTo: '/?closed=1' })
  return { ok: true }
}
