import type { Comment } from '@/payload-types'

import { getPayloadClient } from './payload'

export type CommentTarget = 'reviews' | 'articles' | 'lounges'

// Approved comments under one page, newest first.
export async function getComments(kind: CommentTarget, id: number, limit = 50): Promise<Comment[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'comments',
    where: { and: [{ status: { equals: 'approved' } }, { 'on.relationTo': { equals: kind } }, { 'on.value': { equals: id } }] },
    sort: '-createdAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs
}
