import type { CollectionConfig } from 'payload'

import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, LOUNGE_ACCESS, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '../lib/stayOptions'

// Stays reported on forums (Reddit, FlyerTalk), extracted by the pipeline in
// loyalist-pipeline and imported by the `sourced-reports` step. A third
// source, weaker than reader stays and never mixed with them: the hotel page
// tallies them in their own block with a link to every source post. Only
// extracted fields and a fresh summary are stored, never the post's words.

const unknown = { label: 'Not stated', value: 'unknown' }

export const SourcedReports: CollectionConfig = {
  slug: 'sourced-reports',
  labels: { singular: 'Reported stay', plural: 'Reported stays' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['hotel', 'source', 'statusHeld', 'stayMonth', 'upgrade', 'confidence', 'status'],
    group: 'Reader data',
    description: 'Stays members described on Reddit and FlyerTalk. Approved ones count in the Aggregated data block on the hotel page.',
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  defaultSort: '-postDate',
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'confidence',
      type: 'select',
      required: true,
      admin: { position: 'sidebar', description: 'How sure the extraction was that this is a first-hand stay with the fields stated outright.' },
      options: [
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'hotel', type: 'relationship', relationTo: 'hotels', required: true, index: true },
        { name: 'program', type: 'relationship', relationTo: 'programs', index: true },
        { name: 'statusHeld', type: 'relationship', relationTo: 'status-levels', index: true, admin: { description: 'Blank when the post did not say.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'source',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: 'Reddit', value: 'reddit' },
            { label: 'FlyerTalk', value: 'flyertalk' },
            { label: 'Blog', value: 'blog' },
          ],
        },
        { name: 'postUrl', type: 'text', required: true, admin: { description: 'The post the stay was read from.' } },
        { name: 'postDate', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
        { name: 'stayMonth', type: 'text', admin: { description: 'YYYY-MM when the post pins the stay down.' } },
      ],
    },
    { name: 'summary', type: 'textarea', required: true, admin: { description: 'Written by the extraction in its own words, never quoted from the post.' } },
    {
      type: 'row',
      fields: [
        { name: 'upgrade', type: 'select', required: true, options: [...UPGRADE_OUTCOMES, unknown] },
        { name: 'upgradeType', type: 'select', options: UPGRADE_TYPES },
        { name: 'suiteType', type: 'select', options: SUITE_TYPES },
        { name: 'upgradeHow', type: 'select', options: UPGRADE_HOW },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'breakfast', type: 'select', required: true, options: [...BREAKFAST_OUTCOMES, unknown] },
        { name: 'loungeAccess', type: 'select', required: true, options: [...LOUNGE_ACCESS, unknown] },
        { name: 'lateCheckout', type: 'select', required: true, options: [...LATE_CHECKOUT_OUTCOMES, unknown] },
        {
          name: 'welcomeAmenity',
          type: 'select',
          required: true,
          options: [
            { label: 'Given', value: 'given' },
            { label: 'Not given', value: 'not-given' },
            unknown,
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'roomBooked', type: 'text' },
        { name: 'roomReceived', type: 'text' },
        {
          name: 'sentiment',
          type: 'select',
          required: true,
          options: [
            { label: 'Positive', value: 'positive' },
            { label: 'Mixed', value: 'mixed' },
            { label: 'Negative', value: 'negative' },
          ],
        },
      ],
    },
    { name: 'sourceKey', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar', readOnly: true, description: 'Source and post id, so a rerun updates rather than duplicates.' } },
    { name: 'model', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'extractedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
}
