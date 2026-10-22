// The photo a hotel, review or lounge shows. One uploaded in the admin
// wins; then the Webflow-hosted one carried over from the old site; a
// review or lounge with neither borrows its hotel's. Null when there is
// none, so the page keeps its gradient or its fallback photo.
//
// Relationships arrive as ids until populated, so every argument is loose:
// an unpopulated upload or hotel simply counts as no photo.

import { mediaUrl } from './format'

type Maybe<T> = T | number | null | undefined
type HotelLike = { heroImage?: unknown; externalImageUrl?: string | null }
type ReviewLike = { heroImage?: unknown; externalImageUrl?: string | null; hotel?: unknown }
type LoungeLike = { image?: unknown; externalImageUrl?: string | null; hotel?: unknown }

const doc = <T extends object>(value: unknown): T | null => (value && typeof value === 'object' ? (value as T) : null)

// Payload writes an upload's address against the configured server URL;
// the path alone is served by whichever host renders the page (the www
// domain, a preview deployment, a local server on another port), and
// og:image still comes out whole through the site's metadataBase.
// Characters that end an unquoted CSS url() early, as in an uploaded
// "Lobby (1).jpg", are percent-encoded so the same address works as a
// background image, an img src and og:image.
function address(url: string | null | undefined): string | null {
  const u = url?.trim().replace(/^https?:\/\/[^/]+(?=\/api\/media\/file\/)/, '')
  if (!u) return null
  return u.replace(/[\s()'"\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
}

// An upload's address with a version that changes whenever the file does.
// Payload hands a file name back out once the upload that held it is
// deleted, and browsers and the CDN keep a photo under its address for a
// day (src/lib/blobStorage.ts), so a re-upload needs an address of its own.
// The file route ignores the query.
function uploadUrl(media: unknown): string | null {
  const url = mediaUrl(media)
  if (!url || !url.includes('/api/media/file/')) return url
  const v = Date.parse(String((media as { updatedAt?: unknown }).updatedAt ?? ''))
  return Number.isFinite(v) ? `${url}${url.includes('?') ? '&' : '?'}v=${v}` : url
}

export function hotelPhoto(hotel: Maybe<HotelLike>): string | null {
  const h = doc<HotelLike>(hotel)
  if (!h) return null
  return address(uploadUrl(h.heroImage)) ?? address(h.externalImageUrl)
}

// The review's own photo, else its hotel's (the hotel passed in, or the
// review's own hotel when populated).
export function reviewPhoto(review: Maybe<ReviewLike>, hotel?: Maybe<HotelLike>): string | null {
  const r = doc<ReviewLike>(review)
  if (!r) return hotelPhoto(hotel)
  return address(uploadUrl(r.heroImage)) ?? address(r.externalImageUrl) ?? hotelPhoto(doc<HotelLike>(hotel) ?? doc<HotelLike>(r.hotel))
}

// The lounge's own photo, else its hotel's, the same way.
export function loungePhoto(lounge: Maybe<LoungeLike>, hotel?: Maybe<HotelLike>): string | null {
  const l = doc<LoungeLike>(lounge)
  if (!l) return hotelPhoto(hotel)
  return address(uploadUrl(l.image)) ?? address(l.externalImageUrl) ?? hotelPhoto(doc<HotelLike>(hotel) ?? doc<HotelLike>(l.hotel))
}

// A program's logo: one uploaded in the admin, else images.logoUrl (the site's own copy under
// public/images/programs once the import's images step has run). Wherever a logo shows, it
// stands alone as the link to the program, its alt the program's name.
type ProgramLike = { logo?: unknown; images?: { logoUrl?: string | null } | null }
export function programLogo(program: Maybe<ProgramLike>): string | null {
  const p = doc<ProgramLike>(program)
  if (!p) return null
  return address(uploadUrl(p.logo)) ?? address(p.images?.logoUrl)
}
