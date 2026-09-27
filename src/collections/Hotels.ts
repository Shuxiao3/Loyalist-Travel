import type { CollectionConfig } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { SEGMENT_OPTIONS } from './Brands'
import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const PROPERTY_TYPE_OPTIONS = [
  { label: 'City hotel', value: 'city' },
  { label: 'Resort', value: 'resort' },
]

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
