// Payload storage on Vercel Blob that signs in either way Vercel offers: the
// newer one, where the project carries BLOB_STORE_ID and Vercel hands each
// function a short-lived token (OIDC), or a long-lived BLOB_READ_WRITE_TOKEN.
// Payload's own Blob adapter only knows the second, and stores connected
// today only get the first.
//
// Files keep Payload's address (/api/media/file/<name>); the static handler
// streams them from the store, which works whether the store was created
// public or private. Which of the two it is gets found out on first use (or
// set with BLOB_ACCESS). Off Vercel (a laptop, a GitHub runner) neither
// credential is present and uploads stay on local disk, as before.

import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import { getFileKey, getFilePrefix } from '@payloadcms/plugin-cloud-storage/utilities'
import { del, get, put } from '@vercel/blob'
import type { Config, Plugin } from 'payload'

export type BlobAccess = 'public' | 'private'

// What reading a stored file gives back.
export type BlobRead = {
  statusCode: 200 | 304
  stream: ReadableStream<Uint8Array> | null
  contentType: string | null
  size: number | null
  etag: string
  uploadedAt: Date
}

// The calls made to the store, so tests can stand in for it.
export type BlobClient = {
  put: (pathname: string, body: Buffer, opts: { access: BlobAccess; contentType?: string }) => Promise<unknown>
  get: (pathname: string, opts: { access: BlobAccess; ifNoneMatch?: string }) => Promise<BlobRead | null>
  del: (pathname: string) => Promise<void>
}

const CACHE_SECONDS = 60 * 60 * 24 * 365

const sdkClient: BlobClient = {
  put: (pathname, body, { access, contentType }) =>
    put(pathname, body, { access, contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: CACHE_SECONDS }),
  get: async (pathname, { access, ifNoneMatch }) => {
    const r = await get(pathname, { access, ifNoneMatch })
    if (!r) return null
    return { statusCode: r.statusCode, stream: r.stream, contentType: r.blob.contentType, size: r.blob.size, etag: r.blob.etag, uploadedAt: r.blob.uploadedAt }
  },
  del: (pathname) => del(pathname),
}

// Whether this deployment can reach a store at all.
export const blobConfigured = () => Boolean(process.env.BLOB_STORE_ID?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim())

// Public or private: from BLOB_ACCESS when set, else learnt from the first
// call that works, and kept for the life of the process.
const fromEnv = (): BlobAccess | null => (process.env.BLOB_ACCESS === 'private' || process.env.BLOB_ACCESS === 'public' ? process.env.BLOB_ACCESS : null)
let learnt: BlobAccess | null = null
export const knownAccess = (): BlobAccess | null => fromEnv() ?? learnt
const other = (a: BlobAccess): BlobAccess => (a === 'public' ? 'private' : 'public')
const order = (): BlobAccess[] => {
  const known = knownAccess()
  return known ? [known] : ['public', 'private']
}
// The store says so when a write asks for the wrong kind of access.
const isAccessMismatch = (err: unknown) => err instanceof Error && /\b(access|private|public)\b/i.test(err.message)

// Only for tests: forget what was learnt.
export function resetBlobAccess() {
  learnt = null
}

export async function writeToStore(client: BlobClient, pathname: string, body: Buffer, contentType?: string) {
  const tries = order()
  for (let i = 0; i < tries.length; i++) {
    try {
      await client.put(pathname, body, { access: tries[i], contentType })
      if (!fromEnv()) learnt = tries[i]
      return
    } catch (err) {
      if (i < tries.length - 1 && isAccessMismatch(err)) continue
      throw err
    }
  }
}

// Null when the file is not in the store under either kind of access.
export async function readFromStore(client: BlobClient, pathname: string, ifNoneMatch?: string): Promise<BlobRead | null> {
  const tries = order()
  for (let i = 0; i < tries.length; i++) {
    let r: BlobRead | null = null
    try {
      r = await client.get(pathname, { access: tries[i], ifNoneMatch })
    } catch (err) {
      // asked under the wrong access, a private store answers 403
      if (i < tries.length - 1) continue
      throw err
    }
    if (r) {
      if (!fromEnv()) learnt = tries[i]
      return r
    }
  }
  return null
}

export function createBlobAdapter(client: BlobClient = sdkClient): Adapter {
  return ({ collection, prefix = '' }) => ({
    name: 'vercel-blob',
    handleUpload: async ({ data, file }) => {
      const { fileKey } = getFileKey({ collectionPrefix: prefix, docPrefix: data?.prefix, filename: file.filename })
      await writeToStore(client, fileKey, file.buffer, file.mimeType)
      return data
    },
    handleDelete: async ({ doc, filename }) => {
      const { fileKey } = getFileKey({ collectionPrefix: prefix, docPrefix: doc.prefix, filename })
      await client.del(fileKey)
    },
    staticHandler: async (req, { headers: incoming, params: { clientUploadContext, filename, prefix: prefixQueryParam } }) => {
      try {
        const docPrefix = await getFilePrefix({ clientUploadContext, collection, filename, prefixQueryParam, req })
        const { fileKey } = getFileKey({ collectionPrefix: prefix, docPrefix, filename })
        const r = await readFromStore(client, fileKey, req.headers.get('if-none-match') ?? undefined)
        if (!r) return new Response(null, { status: 404, statusText: 'Not Found' })
        let headers = new Headers(incoming)
        headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
        if (r.etag) headers.set('ETag', r.etag)
        headers.set('Last-Modified', r.uploadedAt.toUTCString())
        if (r.statusCode === 304) return new Response(null, { status: 304, headers })
        if (r.contentType) headers.set('Content-Type', r.contentType)
        if (r.size != null) headers.set('Content-Length', String(r.size))
        // an uploaded SVG must not run script when opened directly
        if (r.contentType === 'image/svg+xml') headers.set('Content-Security-Policy', "script-src 'none'")
        if (typeof collection.upload === 'object' && typeof collection.upload.modifyResponseHeaders === 'function') {
          headers = collection.upload.modifyResponseHeaders({ headers }) || headers
        }
        return new Response(r.stream, { status: 200, headers })
      } catch (err) {
        req.payload.logger.error({ err, msg: `blob storage: could not serve ${filename}` })
        return new Response('Internal Server Error', { status: 500 })
      }
    },
  })
}

// The plugin: when this deployment has Blob credentials, the named upload
// collections store their files there; otherwise the config is untouched.
export function blobStorage({ collections, client, enabled = blobConfigured() }: { collections: string[]; client?: BlobClient; enabled?: boolean }): Plugin {
  return (incoming: Config): Config => {
    if (!enabled) return incoming
    const adapter = createBlobAdapter(client)
    const config: Config = {
      ...incoming,
      collections: (incoming.collections ?? []).map((c) =>
        collections.includes(c.slug) ? { ...c, upload: { ...(typeof c.upload === 'object' ? c.upload : {}), disableLocalStorage: true } } : c,
      ),
    }
    return cloudStoragePlugin({ collections: Object.fromEntries(collections.map((slug) => [slug, { adapter }])) })(config)
  }
}
