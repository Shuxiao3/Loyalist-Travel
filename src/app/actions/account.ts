'use server'

import { revalidatePath } from 'next/cache'

import { checkDisplayName } from '@/lib/displayName'
import { currentReader } from '@/lib/reader'
import { getPayloadClient } from '@/lib/payload'

export type AccountState = { ok: boolean; error?: string } | null

export async function saveDisplayName(prev: AccountState, formData: FormData): Promise<AccountState> {
  const reader = await currentReader()
  if (!reader) return { ok: false, error: 'Sign in first.' }
  const check = checkDisplayName(String(formData.get('displayName') ?? ''))
  if (!check.ok) return { ok: false, error: check.error }
  const payload = await getPayloadClient()
  const taken = await payload.find({ collection: 'readers', where: { and: [{ displayName: { equals: check.name } }, { id: { not_equals: reader.id } }] }, limit: 1, depth: 0, overrideAccess: true })
  if (taken.docs[0]) return { ok: false, error: 'That name is taken.' }
  await payload.update({ collection: 'readers', id: reader.id, data: { displayName: check.name }, overrideAccess: true, depth: 0 })
  revalidatePath('/account')
  return { ok: true }
}
