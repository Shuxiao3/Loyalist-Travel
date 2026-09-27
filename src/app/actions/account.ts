'use server'

import { revalidatePath } from 'next/cache'

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
