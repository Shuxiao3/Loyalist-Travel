import { createHmac, timingSafeEqual } from 'crypto'

import type { Endpoint } from 'payload'

import { blobConfigured, knownAccess } from '../lib/blobStorage'

// POST /api/blob-check: proves uploads work on this deployment by doing what
// an editor does. It uploads a one-pixel image to Media, fetches it back
// through the site's file address, deletes it and checks it is gone.
// Answers only to the "Check Blob storage" GitHub workflow: the request must
// carry x-blob-check, an HMAC of "blob-check" keyed with PAYLOAD_SECRET;
// anything else gets a plain 404.

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

type Step = { step: string; ok: boolean; detail?: string }
const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300)

export const blobCheck: Endpoint = {
  path: '/blob-check',
  method: 'post',
  handler: async (req) => {
    const secret = process.env.PAYLOAD_SECRET || ''
    const expected = createHmac('sha256', secret).update('blob-check').digest('hex')
    if (!secret || !sameText(req.headers.get('x-blob-check') ?? '', expected)) return Response.json({ error: 'Not found' }, { status: 404 })

    const credentials = { storeId: Boolean(process.env.BLOB_STORE_ID?.trim()), readWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) }
    if (!blobConfigured()) return Response.json({ ok: false, credentials, steps: [], detail: 'This deployment has no Blob credentials (BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN).' })

    const steps: Step[] = []
    const name = `blob-check-${Date.now()}.png`
    let id: number | string | null = null
    let url = ''
    const base = req.payload.config.serverURL || new URL(req.url ?? 'http://localhost').origin
    try {
      const doc = await req.payload.create({ collection: 'media', data: { alt: 'Blob check (removed automatically)' }, file: { data: PIXEL, mimetype: 'image/png', name, size: PIXEL.length }, overrideAccess: true })
      id = doc.id
      url = new URL(doc.url ?? `/api/media/file/${doc.filename}`, base).toString()
      steps.push({ step: 'upload', ok: true, detail: doc.filename ?? name })
    } catch (err) {
      steps.push({ step: 'upload', ok: false, detail: message(err) })
    }
    if (id != null) {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        const body = Buffer.from(await res.arrayBuffer())
        steps.push({ step: 'serve', ok: res.ok && body.equals(PIXEL), detail: `${res.status} ${res.headers.get('content-type') ?? ''} ${body.length} bytes` })
      } catch (err) {
        steps.push({ step: 'serve', ok: false, detail: message(err) })
      }
      try {
        await req.payload.delete({ collection: 'media', id, overrideAccess: true })
        steps.push({ step: 'delete', ok: true })
        const res = await fetch(url, { cache: 'no-store' })
        steps.push({ step: 'gone', ok: res.status === 404, detail: String(res.status) })
      } catch (err) {
        steps.push({ step: 'delete', ok: false, detail: message(err) })
      }
    }
    return Response.json({ ok: steps.length === 4 && steps.every((s) => s.ok), credentials, access: knownAccess(), steps })
  },
}
