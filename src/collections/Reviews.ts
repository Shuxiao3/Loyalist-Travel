import type { CollectionConfig, Field } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { computeReviewScores } from '../hooks/reviewScores'
import { RUBRIC_SECTIONS, RUBRIC_V16 } from '../rubric/v16'
import { PROPERTY_TYPE_OPTIONS } from './Hotels'
import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

const scoreField = (key: string, label: string): Field => ({
  name: key,
  type: 'number',
  label,
  min: 0,
  admin: { step: 0.5, width: '25%' },
})

const narrativeField = (key: string, label: string): Field => ({
  name: key,
  type: 'richText',
  label,
})


const outcome = (name: string, label: string, options: { label: string; value: string }[]): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'outcome', type: 'select', options, admin: { width: '40%' } },
        { name: 'note', type: 'text', admin: { width: '60%' } },
      ],
    },
  ],
})

// Each stay is its own record. Scores are stored per category and validated
// against the rubric version's maxima; totals are computed on save.
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'hotel', 'totals.overall', 'stayDate', '_status'],
    group: 'Scoring',
  },
  access: { read: publishedOrLoggedIn },
  versions: { drafts: true },
  hooks: { beforeChange: [computeReviewScores] },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'hotel', type: 'relationship', relationTo: 'hotels', required: true, index: true },
        { name: 'rubricVersion', type: 'relationship', relationTo: 'rubric-versions', required: true },
        { name: 'propertyType', type: 'select', required: true, options: PROPERTY_TYPE_OPTIONS, admin: { description: 'Drives the maxima.' } },
      ],
    },
    { name: 'shortVerdict', type: 'textarea', admin: { description: 'One sentence under the title and on cards.' } },
    {
      name: 'totals',
      type: 'group',
      admin: { readOnly: true, description: 'Computed on save.' },
      fields: [
        {
          type: 'row',
          fields: [
            ...RUBRIC_SECTIONS.map((s): Field => ({ name: s.id, type: 'number', label: `${s.label} / ${s.max}` })),
            { name: 'overall', type: 'number', index: true },
          ],
        },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'The stay',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'stayDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
                { name: 'nights', type: 'number', min: 1 },
                { name: 'statusHeld', type: 'relationship', relationTo: 'status-levels' },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'roomBooked', type: 'text' },
                { name: 'roomReceived', type: 'text' },
              ],
            },
            {
              name: 'rateBasis',
              type: 'select',
              options: [
                { label: 'Cash', value: 'cash' },
                { label: 'Points', value: 'points' },
                { label: 'Free night certificate', value: 'certificate' },
                { label: 'Credit card portal', value: 'credit-card-portal' },
                { label: 'Third party', value: 'third-party' },
                { label: 'Corporate rate', value: 'corporate-rate' },
                { label: 'Guest of Honor', value: 'guest-of-honor' },
                { label: 'Other', value: 'other' },
              ],
            },
            { name: 'awardNote', type: 'textarea', admin: { description: 'Points price, category, whether it repriced.' } },
          ],
        },
        {
          label: 'Scores',
          fields: [
            {
              name: 'scores',
              type: 'group',
              admin: { description: 'Every sub-score is out of 5. Category totals and the 100-point score are computed on save.' },
              fields: RUBRIC_SECTIONS.map((s): Field => ({ type: 'row', fields: RUBRIC_V16.filter((c) => c.section === s.id).map((c) => scoreField(c.key, `${s.label}: ${c.label}`)) })),
            },
          ],
        },
        {
          label: 'Narrative',
          fields: [
            { name: 'openingThoughts', type: 'richText' },
            { name: 'narrative', type: 'group', fields: RUBRIC_V16.map((c) => narrativeField(c.key, `${RUBRIC_SECTIONS.find((s) => s.id === c.section)!.label}: ${c.label}`)) },
            { name: 'finalVerdict', type: 'richText' },
          ],
        },
        {
          label: 'Elite recognition',
          description: 'Reported as it happened. Not scored.',
          fields: [
            outcome('upgrade', 'Suite upgrade', [
              { label: 'None', value: 'none' },
              { label: 'Room category', value: 'room-category' },
              { label: 'Suite', value: 'suite' },
              { label: 'Used award', value: 'used-award' },
            ]),
            outcome('breakfast', 'Breakfast', [
              { label: 'Full', value: 'full' },
              { label: 'Capped', value: 'capped' },
              { label: 'Restaurant credit', value: 'restaurant-credit' },
              { label: 'None', value: 'none' },
            ]),
            outcome('lateCheckout', 'Late checkout', [
              { label: '4pm confirmed', value: '4pm-confirmed' },
              { label: 'On request', value: 'on-request' },
              { label: 'Refused', value: 'refused' },
              { label: 'Not needed', value: 'not-needed' },
            ]),
            outcome('welcomeAmenity', 'Welcome amenity', [
              { label: 'Points', value: 'points' },
              { label: 'Gift', value: 'gift' },
              { label: 'Food and drink', value: 'food-and-drink' },
              { label: 'None', value: 'none' },
            ]),
            outcome('clubLounge', 'Club lounge', [
              { label: 'None at property', value: 'none-at-property' },
              { label: 'Access', value: 'access' },
              { label: 'Access with restrictions', value: 'access-with-restrictions' },
            ]),
            outcome('guestOfHonor', 'Guest of Honor', [
              { label: 'Not tested', value: 'not-tested' },
              { label: 'Honoured', value: 'honoured' },
              { label: 'Refused', value: 'refused' },
            ]),
          ],
        },
        {
          label: 'Verdict',
          fields: [
            { name: 'pros', type: 'array', label: 'What worked', fields: [{ name: 'text', type: 'text', required: true }] },
            { name: 'cons', type: 'array', label: 'What fell short', fields: [{ name: 'text', type: 'text', required: true }] },
            { name: 'bookItIf', type: 'richText', label: 'Book it if' },
            { name: 'skipItIf', type: 'richText', label: 'Skip it if' },
            {
              type: 'row',
              fields: [
                {
                  name: 'wouldStayAgain',
                  type: 'select',
                  options: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'Maybe', value: 'maybe' },
                    { label: 'No', value: 'no' },
                  ],
                },
                { name: 'valueForCash', type: 'select', options: VALUE_OPTIONS() },
                { name: 'valueForPoints', type: 'select', options: VALUE_OPTIONS() },
              ],
            },
            { name: 'valueNotes', type: 'textarea' },
          ],
        },
        {
          label: 'Publishing',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'publishedDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
                { name: 'lastVerifiedDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
                { name: 'readTime', type: 'number', admin: { description: 'Minutes.' } },
              ],
            },
            {
              name: 'featureSlot',
              type: 'select',
              options: [
                { label: 'None', value: 'none' },
                { label: 'Lead', value: 'lead' },
                { label: 'Secondary', value: 'secondary' },
              ],
            },
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            { name: 'externalImageUrl', type: 'text', admin: { description: 'Webflow-hosted hero until owned photography replaces it.' } },
            {
              name: 'seo',
              type: 'group',
              fields: [
                { name: 'title', type: 'text' },
                { name: 'description', type: 'textarea' },
              ],
            },
          ],
        },
      ],
    },
    webflowIdField,
  ],
}

function VALUE_OPTIONS() {
  return [
    { label: 'Best', value: 'best' },
    { label: 'Great', value: 'great' },
    { label: 'Good', value: 'good' },
    { label: 'Fair', value: 'fair' },
    { label: 'Poor', value: 'poor' },
  ]
}
