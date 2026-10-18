import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, PayloadRequest } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { SEGMENT_OPTIONS } from './Brands'
import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const PROPERTY_TYPE_OPTIONS = [
  { label: 'City hotel', value: 'city' },
  { label: 'Resort', value: 'resort' },
]

// Two counters are stored on the hotel so the index can sort by them:
// stayCount (approved reader stays) and reportCount (those plus approved
// reported stays from the forum pipeline). After any change or delete of a
// stay or a report, the hotel is recounted in plain SQL inside the request's
// transaction: a document update here would write a hotel version from within
// the stay's own operation, which Payload rejects. SQL also means no hotel
// hook fires, so nothing loops, and no access check stands in the way.
//
// The hotel row is locked in a statement of its own first. Two stays for one
// hotel approved in overlapping transactions would otherwise both count under
// their own snapshot: the second waits on the row, then writes a total that
// misses the first's stay. With the lock taken first, the count that follows
// starts after the other transaction has committed and sees its row. FOR NO
// KEY UPDATE, not FOR UPDATE, since the stay's foreign key holds the hotel
// row FOR KEY SHARE, which FOR UPDATE would wait on.
export async function recountHotel(req: PayloadRequest, hotelId: number | null | undefined) {
  if (!hotelId) return
  const { sql } = await import('@payloadcms/db-postgres')
  const adapter = req.payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> }; sessions?: Record<string, { db: { execute: (q: unknown) => Promise<unknown> } }> }
  const db = (req.transactionID && adapter.sessions?.[String(req.transactionID)]?.db) || adapter.drizzle
  await db.execute(sql`select id from hotels where id = ${hotelId} for no key update`)
  await db.execute(sql`update hotels set
    stay_count = (select count(*) from reader_stays where hotel_id = ${hotelId} and status = 'approved'),
    report_count = (select count(*) from reader_stays where hotel_id = ${hotelId} and status = 'approved') + (select count(*) from sourced_reports where hotel_id = ${hotelId} and status = 'approved')
    where id = ${hotelId}`)
  await db.execute(sql`update _hotels_v v set version_stay_count = h.stay_count, version_report_count = h.report_count
    from hotels h where h.id = ${hotelId} and v.parent_id = h.id and v.id = (select max(id) from _hotels_v where parent_id = ${hotelId})`)
}

const hotelIdOf = (doc: { hotel?: number | { id: number } | null } | undefined) => (doc?.hotel && typeof doc.hotel === 'object' ? doc.hotel.id : (doc?.hotel as number | null | undefined))

// For the collections that carry a hotel and count towards it (reader stays,
// sourced reports): recount after every change, both hotels when the stay
// moved, and after every delete.
export const recountHotelAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  await recountHotel(req, hotelIdOf(doc))
  if (previousDoc && hotelIdOf(previousDoc) !== hotelIdOf(doc)) await recountHotel(req, hotelIdOf(previousDoc))
}
export const recountHotelAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => recountHotel(req, hotelIdOf(doc))

// One hotel, many reviews. Aggregates from reader stays are computed, not
// stored here (decision log, content model 5). The Lounges relation arrives
// with Milestone 3.
export const Hotels: CollectionConfig = {
  slug: 'hotels',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'brand', 'destination', 'reviewStatus', '_status'],
    listSearchableFields: ['name', 'slug', 'fullName'],
  },
  access: { read: publishedOrLoggedIn },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'fullName', type: 'text' },
        { name: 'shortName', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'brand', type: 'relationship', relationTo: 'brands', required: true, index: true },
        { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'destination', type: 'relationship', relationTo: 'destinations', required: true, index: true },
        { name: 'neighborhood', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'segment', type: 'select', options: SEGMENT_OPTIONS, index: true, admin: { hidden: true } },
        { name: 'propertyType', type: 'select', options: PROPERTY_TYPE_OPTIONS, index: true },
        {
          name: 'reviewStatus',
          type: 'select',
          index: true,
          defaultValue: 'not-reviewed',
          options: [
            { label: 'Not reviewed', value: 'not-reviewed' },
            { label: 'Reviewed', value: 'reviewed' },
            { label: 'Coming soon', value: 'coming-soon' },
            { label: 'Data only', value: 'data-only' },
          ],
        },
      ],
    },
    { name: 'heroSummary', type: 'textarea' },
    { name: 'reviews', type: 'join', collection: 'reviews', on: 'hotel' },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Property',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'openingYear', type: 'number' },
                { name: 'renovationYear', type: 'number' },
                { name: 'numberOfRooms', type: 'number' },
              ],
            },
            { name: 'amenities', type: 'relationship', relationTo: 'amenities', hasMany: true },
            {
              type: 'row',
              fields: [
                { name: 'checkInTime', type: 'text' },
                { name: 'checkOutTime', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'resortFee', type: 'text' },
                { name: 'petFee', type: 'text' },
                { name: 'pointsEligible', type: 'checkbox', defaultValue: true },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            { name: 'streetAddress', type: 'text' },
            { name: 'phone', type: 'text' },
            { name: 'bookingLink', type: 'text' },
          ],
        },
        {
          label: 'Media',
          fields: [
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            {
              name: 'externalImageUrl',
              type: 'text',
              admin: { description: 'Webflow-hosted hero, used until owned photography replaces it. Also the og:image fallback.' },
            },
          ],
        },
      ],
    },
    {
      name: 'views',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Page views, counted by the site.' },
    },
    {
      name: 'stayCount',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Approved reader stays. Kept in step automatically.' },
    },
    {
      name: 'reportCount',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Approved reader stays plus aggregated reports. Kept in step automatically.' },
    },
    {
      name: 'clubLounge',
      type: 'select',
      index: true,
      admin: { position: 'sidebar', description: 'Whether the hotel has an executive or club lounge, as its own page states (Marriott: by brand and region until a page or report answers). Blank means not checked yet.' },
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Shown as the featured hotel in the homepage carousel.' },
    },
    {
      name: 'enrichmentStatus',
      type: 'select',
      defaultValue: 'none',
      admin: { position: 'sidebar' },
      options: [
        { label: 'None', value: 'none' },
        { label: 'Queued', value: 'queued' },
        { label: 'Enriched', value: 'enriched' },
      ],
    },
    webflowIdField,
  ],
}
