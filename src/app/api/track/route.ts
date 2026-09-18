import { NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/payload'

// A page-view beacon from hotel pages. Adds one to the hotel's view count.
// Nothing about the viewer is stored.
export async function POST(req: Request) {
  let id: unknown
  try {
    id = (await req.json())?.hotel
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 400 })
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
  const { sql } = await import('@payloadcms/db-postgres')
  await db.drizzle.execute(sql`update hotels set views = coalesce(views, 0) + 1 where id = ${id}`)
  return new NextResponse(null, { status: 204 })
}
