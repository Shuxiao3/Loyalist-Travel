// Imports the Webflow export in data/webflow into Payload.
//
//   npm run import:webflow            # everything
//   npm run import:webflow -- hotels  # one collection (dependencies must already be in)
//
// Idempotent: every record carries its Webflow id and is updated in place on a
// re-run. Order matters because references resolve by Webflow id:
// regions, programs, status levels, brands, amenities, destinations, rubric
// versions, hotels, reviews.

import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import Anthropic from '@anthropic-ai/sdk'
import type { CollectionSlug, Payload, Where } from 'payload'
import { getPayload } from 'payload'

import { ARTICLE_CATEGORIES, type ArticleCategory } from '../../src/lib/articleOptions'
import type { Media } from '../../src/payload-types'
import { stayFacts } from '../../src/lib/stayFacts'
import { RUBRIC_PRE_V15, RUBRIC_V15 } from '../../src/rubric/v15'
import { convertV15ToV16, RUBRIC_V16, V15_NARRATIVE_TO_V16 } from '../../src/rubric/v16'
import { htmlToLexical, lexicalWordCount } from './html-to-lexical'

type WebflowItem = {
  id: string
  isDraft: boolean
  isArchived: boolean
  lastPublished: string | null
  fieldData: Record<string, unknown>
}

type Schema = Record<string, { fields: { slug: string; type: string; options?: Record<string, string> }[] }>

const DATA = path.resolve(process.cwd(), 'data/webflow')
const read = (name: string): WebflowItem[] => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), 'utf8'))
const schemas: Schema = JSON.parse(fs.readFileSync(path.join(DATA, 'schemas.json'), 'utf8'))

// Option field id -> label, then label -> select value.
const optionLabel = (collection: string, field: string, id: unknown): string | null => {
  if (!id) return null
  const f = schemas[collection].fields.find((x) => x.slug === field)
  return f?.options?.[String(id)] ?? null
}
const slugify = (label: string | null): string | null =>
  label ? label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null

const imageUrl = (v: unknown): string | null => (v && typeof v === 'object' && 'url' in v ? String((v as { url: string }).url) : null)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
const bool = (v: unknown): boolean => v === true

const droppedImages: string[] = []
const rich = (v: unknown) => {
  const r = htmlToLexical(typeof v === 'string' ? v : null)
  droppedImages.push(...r.droppedImages)
  return r.value
}

// Webflow id -> Payload id, per collection, loaded from what is already in
// the database so re-runs and partial runs resolve references.
const idMaps: Partial<Record<CollectionSlug, Map<string, number>>> = {}

async function loadIdMap(payload: Payload, collection: CollectionSlug) {
  const map = new Map<string, number>()
  let page = 1
  for (;;) {
    const res = await payload.find({ collection, limit: 500, page, depth: 0, pagination: true, overrideAccess: true, draft: true, select: { webflowId: true } as never })
    for (const doc of res.docs as { id: number; webflowId?: string | null }[]) if (doc.webflowId) map.set(doc.webflowId, doc.id)
    if (!res.hasNextPage) break
    page++
  }
  idMaps[collection] = map
  return map
}

const ref = (collection: CollectionSlug, webflowId: unknown): number | null => {
  if (!webflowId) return null
  const id = idMaps[collection]?.get(String(webflowId))
  if (id == null) throw new Error(`Unresolved ${collection} reference ${webflowId}`)
  return id
}
const refs = (collection: CollectionSlug, ids: unknown): number[] =>
  Array.isArray(ids) ? ids.map((i) => ref(collection, i)).filter((i): i is number => i != null) : []

async function upsert(payload: Payload, collection: CollectionSlug, item: WebflowItem, data: Record<string, unknown>, drafts: boolean) {
  const map = idMaps[collection] ?? (await loadIdMap(payload, collection))
  const existing = map.get(item.id)
  const payloadData = { ...data, webflowId: item.id } as never
  const status = drafts ? { _status: item.isDraft ? 'draft' : 'published' } : {}
  const body = { ...(payloadData as object), ...status } as never
  const doc = existing
    ? await payload.update({ collection, id: existing, data: body, depth: 0, overrideAccess: true, draft: item.isDraft })
    : await payload.create({ collection, data: body, depth: 0, overrideAccess: true, draft: item.isDraft })
  map.set(item.id, (doc as { id: number }).id)
  return doc
}

async function run(payload: Payload, name: string, items: WebflowItem[], fn: (item: WebflowItem) => Promise<unknown>) {
  const started = Date.now()
  let n = 0
  for (const item of items) {
    try {
      await fn(item)
    } catch (err) {
      console.error(`\n${name} ${item.fieldData.slug} (${item.id}) failed:`, err instanceof Error ? err.message : err)
      throw err
    }
    n++
    if (n % 250 === 0 || n === items.length) process.stdout.write(`\r${name}: ${n}/${items.length}`)
  }
  console.log(`  ${Math.round((Date.now() - started) / 1000)}s`)
}

// ---- collections ------------------------------------------------------------

const importRegions = (payload: Payload) =>
  run(payload, 'regions', read('regions'), (item) => {
    const f = item.fieldData
    return upsert(payload, 'regions', item, { name: f.name, slug: f.slug, displayOrder: num(f['display-order']) }, false)
  })

const importPrograms = (payload: Payload) =>
  run(payload, 'programs', read('programs'), (item) => {
    const f = item.fieldData
    return upsert(payload, 'programs', item, {
      name: f.name,
      slug: f.slug,
      shortDescription: text(f['short-description']),
      overview: rich(f['program-overview']),
      eliteTiersDescription: text(f['elite-tiers-description']),
      topTierName: text(f['top-tier-name']),
      secondTierName: text(f['second-tier-name']),
      images: { logoUrl: imageUrl(f['program-logo']), heroImageUrl: imageUrl(f['hero-image']) },
      seo: { title: text(f['seo-title']), description: text(f['seo-description']) },
    }, false)
  })

// Tiers readers never pick from stay out (Lifetime Globalist carries Globalist benefits).
const RETIRED_TIERS = new Set(['hyatt-lifetime-globalist'])

const importStatusLevels = (payload: Payload) =>
  run(payload, 'status-levels', read('status-levels').filter((item) => !RETIRED_TIERS.has(String(item.fieldData.slug))), (item) => {
    const f = item.fieldData
    return upsert(payload, 'status-levels', item, {
      name: f.name,
      slug: f.slug,
      program: ref('programs', f['loyalty-program']),
      shortName: text(f['tier-short-name']),
      rank: num(f['status-rank']),
      isTopTier: bool(f['is-top-tier']),
      nights: text(f['tier-nights']),
      shortDescription: text(f['short-description']),
      benefits: rich(f['tier-benefits']),
      eligibility: {
        breakfast: bool(f['breakfast-eligible']),
        lounge: bool(f['lounge-eligible']),
        suiteUpgrade: bool(f['suite-upgrade-eligible']),
        lateCheckout: bool(f['late-checkout-eligible']),
      },
      creditCard: { grantsStatus: bool(f['top-cc-status']), source: text(f['cc-status-source']) },
    }, false)
  })

const importBrands = (payload: Payload) =>
  run(payload, 'brands', read('brands'), (item) => {
    const f = item.fieldData
    return upsert(payload, 'brands', item, {
      name: f.name,
      slug: f.slug,
      program: ref('programs', f['parent-loyalty-program']),
      segment: slugify(optionLabel('brands', 'brand-segment', f['brand-segment'])),
      shortDescription: text(f['short-description']),
      overview: rich(f['brand-overview']),
      logoUrl: imageUrl(f['brand-logo']),
    }, false)
  })

const importAmenities = (payload: Payload) =>
  run(payload, 'amenities', read('amenities'), (item) => {
    const f = item.fieldData
    return upsert(payload, 'amenities', item, { name: f.name, slug: f.slug, iconUrl: imageUrl(f.icon) }, false)
  })

const importDestinations = (payload: Payload) =>
  run(payload, 'destinations', read('destinations'), (item) => {
    const f = item.fieldData
    return upsert(payload, 'destinations', item, {
      name: f.name,
      slug: f.slug,
      city: text(f.city),
      stateOrRegion: text(f['state-or-region']),
      country: text(f.country),
      locationLabel: text(f['location-label']),
      region: ref('regions', f.region),
      type: slugify(optionLabel('destinations', 'destination-type', f['destination-type'])),
      shortDescription: text(f['short-description']),
      overview: rich(f['destination-overview']),
      imageUrl: imageUrl(f.image),
      seo: { title: text(f['seo-title']), description: text(f['seo-description']) },
    }, true)
  })

// Rubric versions are seeded from code, not Webflow. v15 is the current
// locked version; the Webflow reviews were scored on the version before it.
async function importRubricVersions(payload: Payload) {
  const seed = async (slug: string, name: string, notes: string, categories: typeof RUBRIC_V15) => {
    const existing = await payload.find({ collection: 'rubric-versions', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
    const data = {
      name,
      slug,
      locked: true,
      notes,
      categories: categories.map((c) => ({ key: c.key, label: c.label, maxCity: c.maxCity, maxResort: c.maxResort })),
    }
    if (existing.docs[0]) {
      await payload.update({ collection: 'rubric-versions', id: existing.docs[0].id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'rubric-versions', data, overrideAccess: true })
    }
    console.log(`rubric-versions: ${slug}`)
  }
  await seed('v15', 'Rubric v15', 'Locked Sep 16 2026. Maxima from the scoring workbook, Luxury Criteria sheet.', RUBRIC_V15)
  await seed('pre-v15', 'Pre-v15 (Webflow)', 'The version the eight Webflow reviews were scored on: v15 with Bed and sleep out of 5 and Tech out of 3.', RUBRIC_PRE_V15)
  // v16: six categories, nineteen sub-scores out of 5, no weights
  const v16 = await payload.find({ collection: 'rubric-versions', where: { slug: { equals: 'v16' } }, limit: 1, overrideAccess: true })
  const v16data = {
    name: 'Rubric v16',
    slug: 'v16',
    locked: false,
    notes: 'Six categories (Room, Property, Service, Operations, Breakfast, Atmosphere), nineteen sub-scores out of 5, 100 points. Same maxima for city hotels and resorts. Value and elite recognition are reported, not scored.',
    categories: RUBRIC_V16.map((c) => ({ key: c.key, label: c.label, section: c.section, maxCity: c.max, maxResort: c.max })),
  }
  if (v16.docs[0]) await payload.update({ collection: 'rubric-versions', id: v16.docs[0].id, data: v16data, overrideAccess: true })
  else await payload.create({ collection: 'rubric-versions', data: v16data, overrideAccess: true })
  console.log('rubric-versions: v16')
}

const rubricVersionId = async (payload: Payload, slug: string) => {
  const res = await payload.find({ collection: 'rubric-versions', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
  if (!res.docs[0]) throw new Error(`Rubric version ${slug} missing; run rubric-versions first`)
  return res.docs[0].id
}

const importHotels = (payload: Payload) =>
  run(payload, 'hotels', read('hotels'), (item) => {
    const f = item.fieldData
    const reviewStatus = slugify(optionLabel('hotels', 'review-status', f['review-status'])) ?? 'not-reviewed'
    return upsert(payload, 'hotels', item, {
      name: f.name,
      slug: f.slug,
      fullName: text(f['full-name']),
      shortName: text(f['short-name']),
      brand: ref('brands', f.brand),
      program: ref('programs', f['loyalty-program']),
      destination: ref('destinations', f.destination),
      neighborhood: text(f.neighborhood),
      segment: slugify(optionLabel('hotels', 'property-segment', f['property-segment'])),
      reviewStatus,
      heroSummary: text(f['hero-summary']),
      openingYear: num(f['opening-year']),
      renovationYear: num(f['renovation-year']),
      numberOfRooms: num(f['number-of-rooms']),
      amenities: refs('amenities', f.amenities),
      checkInTime: text(f['check-in-time']),
      checkOutTime: text(f['check-out-time']),
      resortFee: text(f['resort-fee']),
      petFee: text(f['pet-fee']),
      pointsEligible: f['points-eligible'] !== false,
      streetAddress: text(f['street-address']),
      phone: text(f['phone-number']),
      bookingLink: text(f['booking-link']),
      externalImageUrl: imageUrl(f['hero-image']),
    }, true)
  })

// Webflow score field -> rubric key. Same sixteen categories, different names.
const SCORE_MAP: Record<string, string> = {
  'room-layout': 'roomLayout',
  bathroom: 'bathroom',
  'bed-sleep': 'bedAndSleep',
  'tech-implementation': 'tech',
  amenities: 'amenities',
  'atmosphere-design': 'atmosphere',
  'maintenance-upkeep': 'maintenance',
  'location-and-or-view': 'location',
  'check-in-arrival': 'checkIn',
  'service-operational-excellence': 'serviceBaseline',
  'service-peak-anticipation': 'servicePeak',
  'operational-excellence': 'operations',
  housekeeping: 'housekeeping',
  breakfast: 'breakfastAndDining',
  'crowding-exclusivity': 'density',
  'departure-experience': 'departure',
}

const RATE_BASIS: Record<string, string> = {
  Cash: 'cash',
  Points: 'points',
  'Free Night Certificate': 'certificate',
  'Credit Card Portal': 'credit-card-portal',
  'Third Party': 'third-party',
  'Corporate Rate': 'corporate-rate',
  'Guest of Honor': 'guest-of-honor',
  Other: 'other',
}

async function importReviews(payload: Payload) {
  const v16 = await rubricVersionId(payload, 'v16')
  await run(payload, 'reviews', read('reviews'), async (item) => {
    const f = item.fieldData
    // the Webflow sheet is scored on the pre-v15 rubric; read it across to v16
    const old: Record<string, number | null> = {}
    const oldNarrative: Record<string, unknown> = {}
    for (const [wf, key] of Object.entries(SCORE_MAP)) {
      old[key] = num(f[`${wf}-score`])
      oldNarrative[key] = rich(f[`${wf}-review`])
    }
    const propertyType = optionLabel('reviews', 'property-type', f['property-type']) === 'Resort' ? 'resort' : 'city'
    const scores = convertV15ToV16(old, propertyType)
    const narrative: Record<string, unknown> = {}
    for (const [oldKey, newKey] of Object.entries(V15_NARRATIVE_TO_V16)) {
      const doc = oldNarrative[oldKey] as { root?: { children?: unknown[] } } | null
      if (!doc) continue
      const have = narrative[newKey] as { root?: { children?: unknown[] } } | undefined
      narrative[newKey] = have?.root?.children ? { ...have, root: { ...have.root, children: [...have.root.children, ...(doc.root?.children ?? [])] } } : doc
    }
    const opening = rich(f['opening-thoughts'])
    const verdict = rich(f['final-verdict'])
    const bookItIf = rich(f['recommended-for'])
    const skipItIf = rich(f['not-recommended-for'])
    const words = [opening, verdict, bookItIf, skipItIf, ...Object.values(narrative)].reduce<number>((n, d) => n + lexicalWordCount(d as never), 0)

    const doc = await upsert(payload, 'reviews', item, {
      title: f.name,
      slug: f.slug,
      hotel: ref('hotels', f.hotel),
      rubricVersion: v16,
      propertyType,
      shortVerdict: text(f['short-verdict']),
      stayDate: text(f['stay-date']),
      statusHeld: ref('status-levels', f['elite-status-during-stay']),
      roomBooked: text(f['room-booked']),
      roomReceived: text(f['room-received']),
      rateBasis: RATE_BASIS[optionLabel('reviews', 'booking-method', f['booking-method']) ?? ''] ?? null,
      scores,
      openingThoughts: opening,
      narrative,
      finalVerdict: verdict,
      bookItIf,
      skipItIf,
      wouldStayAgain: slugify(optionLabel('reviews', 'would-i-stay-here-again', f['would-i-stay-here-again'])),
      valueForCash: slugify(optionLabel('reviews', 'value-for-cash', f['value-for-cash'])),
      valueForPoints: slugify(optionLabel('reviews', 'value-for-points', f['value-for-points'])),
      valueNotes: text(f['cash-points-value-notes']),
      publishedDate: text(f['publish-date']),
      lastVerifiedDate: text(f['publish-date']),
      readTime: Math.max(1, Math.round(words / 230)),
      featureSlot: slugify(optionLabel('reviews', 'feature-slot', f['feature-slot'])) ?? 'none',
      externalImageUrl: imageUrl(f['hero-image']),
      seo: { title: text(f['meta-title']), description: text(f['meta-description']) },
    }, true)

  })
}

// Publishes every draft hotel and destination. Webflow held the sourcing
// master as drafts; the site shows the whole index (decided Sep 17 2026).
async function publishAll(payload: Payload) {
  for (const collection of ['destinations', 'hotels'] as const) {
    const before = await payload.count({ collection, where: { _status: { equals: 'draft' } }, overrideAccess: true })
    if (before.totalDocs === 0) {
      console.log(`${collection}: nothing to publish`)
      continue
    }
    const started = Date.now()
    const res = await payload.update({
      collection,
      where: { _status: { equals: 'draft' } },
      data: { _status: 'published' },
      depth: 0,
      overrideAccess: true,
    })
    console.log(`${collection}: published ${res.docs.length} (${res.errors.length} errors)  ${Math.round((Date.now() - started) / 1000)}s`)
    for (const e of res.errors.slice(0, 5)) console.log('  ', e.id, e.message)
  }
}

// The same as publish, done in SQL: seconds instead of one round trip per
// record. Safe because neither collection has save hooks. Flips the main
// row and the latest version row, which is what Payload's publish does.
async function publishAllFast(payload: Payload) {
  const { sql } = await import('@payloadcms/db-postgres')
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
  for (const table of ['destinations', 'hotels'] as const) {
    const before = await payload.count({ collection: table, where: { _status: { equals: 'draft' } }, overrideAccess: true })
    await db.drizzle.execute(sql.raw(`update ${table} set _status = 'published', updated_at = now() where _status = 'draft'`))
    await db.drizzle.execute(sql.raw(`update _${table}_v set version__status = 'published', updated_at = now() where latest = true and version__status = 'draft'`))
    const after = await payload.count({ collection: table, where: { _status: { equals: 'published' } }, overrideAccess: true })
    console.log(`${table}: published ${before.totalDocs} drafts; ${after.totalDocs} now published`)
  }
}

// Downloads each program's Webflow-hosted logo into Media and attaches it.
// Skips programs that already have one. Needs network access to Webflow's
// CDN, which the GitHub workflow has.
async function importLogos(payload: Payload) {
  const programs = await payload.find({ collection: 'programs', limit: 20, depth: 0, overrideAccess: true })
  for (const program of programs.docs) {
    const url = program.images?.logoUrl
    if (!url) {
      console.log(`logos: ${program.slug}: no Webflow logo`)
      continue
    }
    if (program.logo) {
      console.log(`logos: ${program.slug}: already has a logo`)
      continue
    }
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`logos: ${program.slug}: download failed (${res.status})`)
      continue
    }
    const data = Buffer.from(await res.arrayBuffer())
    const mimetype = res.headers.get('content-type')?.split(';')[0] || (url.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
    const ext = mimetype === 'image/svg+xml' ? 'svg' : mimetype === 'image/jpeg' ? 'jpg' : 'png'
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${program.name} logo`, credit: program.name },
      file: { data, mimetype, name: `${program.slug}-logo.${ext}`, size: data.length },
      overrideAccess: true,
    })
    await payload.update({ collection: 'programs', id: program.id, data: { logo: media.id }, overrideAccess: true })
    console.log(`logos: ${program.slug}: ${media.filename} (${data.length} bytes)`)
  }
}

// Mock reader stays on Park Hyatt New York so the reader-data panel can be
// seen with numbers before real submissions arrive. Tagged with a mock
// submitter hash; unseed-stays removes exactly these.
const MOCK_HASH = 'mock-seed'
async function seedStays(payload: Payload) {
  const hotel = (await payload.find({ collection: 'hotels', where: { slug: { equals: 'park-hyatt-new-york' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!hotel) throw new Error('park-hyatt-new-york not found')
  const programId = typeof hotel.program === 'object' ? hotel.program.id : hotel.program
  const tier = async (slug: string) => (await payload.find({ collection: 'status-levels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]?.id
  const globalist = await tier('hyatt-globalist')
  const explorist = await tier('hyatt-explorist')
  const discoverist = await tier('hyatt-discoverist')
  const lifetime = await tier('hyatt-lifetime-globalist')
  if (!globalist || !explorist || !discoverist || !lifetime) throw new Error('Hyatt tiers missing')
  // [tier, upgrade, upgradeType, suiteType, upgradeHow, breakfast, alaCarteCap, lateCheckout]
  const rows: [number, string, string | null, string | null, string | null, string, string | null, string][] = [
    [globalist, 'yes', 'suite', 'junior', 'proactive', 'full', 'uncapped', 'honoured'],
    [globalist, 'yes', 'category', null, 'proactive', 'full', 'uncapped', 'honoured'],
    [globalist, 'yes', 'view', null, 'asked', 'full', 'capped', 'not-requested'],
    [globalist, 'none', null, null, null, 'full', 'uncapped', 'declined'],
    [globalist, 'yes', 'suite', 'one-bedroom', 'proactive', 'full', 'uncapped', 'honoured'],
    [globalist, 'yes', 'category', null, 'asked', 'buffet', null, 'honoured'],
    [globalist, 'award', null, 'one-bedroom', null, 'full', 'uncapped', 'honoured'],
    [globalist, 'yes', 'floor', null, 'proactive', 'full', 'uncapped', 'honoured'],
    [globalist, 'yes', 'suite', 'junior', 'asked', 'a-la-carte', 'uncapped', 'honoured'],
    [globalist, 'none', null, null, null, 'a-la-carte', 'capped', 'honoured'],
    [globalist, 'yes', 'category', null, 'proactive', 'full', 'uncapped', 'not-requested'],
    [globalist, 'award', null, 'junior', null, 'full', 'uncapped', 'honoured'],
    [lifetime, 'yes', 'suite', 'one-bedroom', 'proactive', 'full', 'uncapped', 'honoured'],
    [lifetime, 'yes', 'suite', 'two-bedroom', 'proactive', 'full', 'uncapped', 'honoured'],
    [lifetime, 'yes', 'category', null, 'proactive', 'full', 'uncapped', 'honoured'],
    [explorist, 'yes', 'floor', null, 'asked', 'not-eligible', null, 'honoured'],
    [explorist, 'none', null, null, null, 'not-eligible', null, 'declined'],
    [explorist, 'none', null, null, null, 'not-eligible', null, 'not-requested'],
    [explorist, 'yes', 'view', null, 'proactive', 'not-eligible', null, 'honoured'],
    [explorist, 'none', null, null, null, 'not-eligible', null, 'declined'],
    [discoverist, 'none', null, null, null, 'not-eligible', null, 'honoured'],
    [discoverist, 'none', null, null, null, 'not-eligible', null, 'not-requested'],
    [discoverist, 'yes', 'floor', null, 'asked', 'not-eligible', null, 'declined'],
    [discoverist, 'none', null, null, null, 'not-eligible', null, 'declined'],
  ]
  const existing = await payload.count({ collection: 'reader-stays', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  if (existing.totalDocs > 0) {
    console.log(`seed-stays: ${existing.totalDocs} mock stays already present; run unseed-stays first`)
    return
  }
  // a mock lounge, so the lounge questions and pages have something to show
  let lounge = (await payload.find({ collection: 'lounges', where: { slug: { equals: 'mock-park-club-new-york' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!lounge) {
    lounge = await payload.create({
      collection: 'lounges',
      overrideAccess: true,
      data: {
        name: 'Park Club (mock)',
        slug: 'mock-park-club-new-york',
        hotel: hotel.id,
        location: '25th floor',
        access: { tiers: [globalist, lifetime], clubRooms: true, paid: '' },
        services: [
          { service: 'breakfast', from: '6:30am', to: '10:30am' },
          { service: 'afternoon-tea', from: '2:30pm', to: '4:30pm' },
          { service: 'evening', from: '5:30pm', to: '7:30pm' },
        ],
        dressCode: 'Smart casual',
        _status: 'published',
      } as never,
    })
  }
  // [access, rating, worthIt] for the Globalist and Lifetime rows; the others are not eligible
  // [access, food, drink, space, service, overall, worthIt, comment]
  type LA = [string, number | null, number | null, number | null, number | null, number | null, string | null, string | null]
  const loungeAnswers: (LA | null)[] = [
    ['given', 4, 4, 5, 4, 4, 'yes', 'Breakfast is the same kitchen as the restaurant, served in a quieter room. Evening spread is enough for dinner if you are not fussy.'],
    ['given', 4, 3, 4, 4, 4, 'yes', null],
    ['given', 3, 3, 4, 3, 3, 'no', 'Pleasant, but at these rates I would rather eat downstairs.'],
    ['declined', null, null, null, null, null, null, 'Told Globalist access only comes with the club room now. Worth checking before you book.'],
    ['given', 5, 4, 5, 5, 5, 'yes', 'Staff remembered our names by day two. The 25th-floor view at cocktail hour is the reason to book here.'],
    ['given', 4, 4, 4, 4, 4, 'yes', null],
    ['given', 4, 5, 5, 4, 5, 'yes', 'Proper cocktails, made to order, and a decent Sancerre. Rare.'],
    ['not-used', null, null, null, null, null, null, null],
    ['given', 4, 3, 4, 4, 4, 'yes', null],
    ['given', 3, 2, 4, 3, 3, 'no', 'Wine list is thin and the canapés ran out by seven on a Saturday.'],
    ['given', 4, 4, 4, 4, 4, 'yes', null],
    ['given', 5, 4, 5, 5, 5, 'yes', null],
    ['given', 5, 4, 5, 5, 5, 'yes', 'Lifetime here. Quietest lounge in the Hyatt system I have used, and the afternoon tea is genuinely good.'],
    ['given', 5, 5, 5, 5, 5, 'yes', null],
    ['given', 4, 4, 5, 4, 4, 'yes', null],
    null, null, null, null, null, null, null, null, null,
  ]
  let i = 0
  let ratings = 0
  for (const [statusHeld, upgrade, upgradeType, suiteType, upgradeHow, breakfast, alaCarteCap, lateCheckout] of rows) {
    const la = loungeAnswers[i++]
    await payload.create({
      collection: 'reader-stays',
      overrideAccess: true,
      data: { status: 'approved', hotel: hotel.id, program: programId, statusHeld, stayYear: 2026, upgrade, upgradeType, suiteType, upgradeHow, breakfast, alaCarteCap, lateCheckout, submitterHash: MOCK_HASH } as never,
    })
    if (la) {
      await payload.create({
        collection: 'lounge-ratings',
        overrideAccess: true,
        data: { status: 'approved', lounge: lounge.id, statusHeld, stayYear: 2026, access: la[0], food: la[1], drink: la[2], space: la[3], service: la[4], overall: la[5], worthIt: la[6], comment: la[7], submitterHash: MOCK_HASH } as never,
      })
      ratings++
    }
  }
  console.log(`seed-stays: ${rows.length} approved mock stays on ${hotel.name}, a mock lounge and ${ratings} lounge ratings`)
  await recountReportCounts(payload)
}

async function unseedStays(payload: Payload) {
  const res = await payload.delete({ collection: 'reader-stays', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  const r = await payload.delete({ collection: 'lounge-ratings', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  const l = await payload.delete({ collection: 'lounges', where: { slug: { equals: 'mock-park-club-new-york' } }, overrideAccess: true })
  console.log(`unseed-stays: removed ${res.docs.length} mock stays, ${r.docs.length} lounge ratings and ${l.docs.length} mock lounge`)
  await recountReportCounts(payload)
}

// hotels.stay_count (approved reader stays) and hotels.report_count (those
// plus approved reported stays) are kept in step by hooks one record at a
// time; after a bulk step one SQL pass sets every hotel straight, latest
// version row included, and says how many were off.
async function recountReportCounts(payload: Payload) {
  const { sql } = await import('@payloadcms/db-postgres')
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: unknown[] }> } }
  const changed = await db.drizzle.execute(sql`
    update hotels h set stay_count = sub.rs, report_count = sub.rs + sub.sr from (
      select h2.id,
        (select count(*) from reader_stays rs where rs.hotel_id = h2.id and rs.status = 'approved') as rs,
        (select count(*) from sourced_reports sr where sr.hotel_id = h2.id and sr.status = 'approved') as sr
      from hotels h2
    ) sub where sub.id = h.id and (h.stay_count is distinct from sub.rs or h.report_count is distinct from sub.rs + sub.sr)
    returning h.id`)
  await db.drizzle.execute(sql`
    update _hotels_v v set version_stay_count = h.stay_count, version_report_count = h.report_count from hotels h
    where v.parent_id = h.id and v.latest = true and (v.version_stay_count is distinct from h.stay_count or v.version_report_count is distinct from h.report_count)`)
  console.log(`recount: stay_count or report_count changed on ${changed.rows.length} hotel(s)`)
}

// Program logos from Webflow, downloaded into public/images/programs so the
// site serves them itself. Records the paths in data/images.json; the
// images step then points each program at its copy.
async function fetchLogos(payload: Payload) {
  const programs = await payload.find({ collection: 'programs', limit: 20, depth: 0, overrideAccess: true })
  const file = path.resolve(process.cwd(), 'data/images.json')
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { programs?: Record<string, string> }
  json.programs = json.programs ?? {}
  const dir = path.resolve(process.cwd(), 'public/images/programs')
  fs.mkdirSync(dir, { recursive: true })
  for (const program of programs.docs) {
    const url = program.images?.logoUrl
    if (!url || !/^https?:/.test(url)) {
      console.log(`logos-local: ${program.slug}: nothing to fetch`)
      continue
    }
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`logos-local: ${program.slug}: download failed (${res.status})`)
      continue
    }
    const data = Buffer.from(await res.arrayBuffer())
    const type = res.headers.get('content-type')?.split(';')[0] ?? ''
    const ext = type === 'image/svg+xml' || url.endsWith('.svg') ? 'svg' : type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'
    fs.writeFileSync(path.join(dir, `${program.slug}.${ext}`), data)
    json.programs[program.slug] = `/images/programs/${program.slug}.${ext}`
    console.log(`logos-local: ${program.slug}: ${data.length} bytes`)
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
}

// Photographs from data/images.json onto hotels (externalImageUrl) and
// program logos (images.logoUrl), by slug.
async function applyImages(payload: Payload) {
  const file = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/images.json'), 'utf8')) as { hotels?: Record<string, string>; programs?: Record<string, string>; brands?: Record<string, string> }
  let n = 0
  for (const [slug, url] of Object.entries(file.brands ?? {})) {
    const brand = (await payload.find({ collection: 'brands', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!brand) {
      console.log(`images: no brand with slug ${slug}`)
      continue
    }
    if (brand.logoUrl === url) continue
    await payload.update({ collection: 'brands', id: brand.id, data: { logoUrl: url }, overrideAccess: true })
    n++
  }
  // a brand whose fetched logo was since dropped goes back to no logo
  const stale = (await payload.find({ collection: 'brands', where: { logoUrl: { like: '/images/brands/' } }, limit: 200, depth: 0, overrideAccess: true })).docs.filter((b) => !file.brands?.[b.slug])
  for (const b of stale) {
    await payload.update({ collection: 'brands', id: b.id, data: { logoUrl: null }, overrideAccess: true })
    n++
  }
  for (const [slug, url] of Object.entries(file.programs ?? {})) {
    const program = (await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!program) {
      console.log(`images: no program with slug ${slug}`)
      continue
    }
    if (program.images?.logoUrl === url) continue
    await payload.update({ collection: 'programs', id: program.id, data: { images: { ...(program.images ?? {}), logoUrl: url } }, overrideAccess: true })
    n++
  }
  for (const [slug, url] of Object.entries(file.hotels ?? {})) {
    const hotel = (await payload.find({ collection: 'hotels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!hotel) {
      console.log(`images: no hotel with slug ${slug}`)
      continue
    }
    if (hotel.externalImageUrl === url) continue
    await payload.update({ collection: 'hotels', id: hotel.id, data: { externalImageUrl: url }, overrideAccess: true })
    n++
  }
  console.log(`images: set ${n} image path(s)`)
}

// Six short mock articles across the categories, so the hub and template have
// something to show. Removed by unseed-articles.
const MOCK_ARTICLES: { title: string; slug: string; category: ArticleCategory; dek: string; date: string; paras: string[] }[] = [
  { title: 'What Globalist actually gets you at check-in (mock)', slug: 'mock-globalist-check-in', category: 'guides', date: '2026-09-10', dek: 'The printed benefits, then what readers report receiving. The gap is the point.', paras: ['World of Hyatt prints a clear list for Globalist: a room upgrade including standard suites, 4pm late checkout, free breakfast or club access, and waived resort fees. The question is how often the front desk delivers.', 'Reader stays say most of it holds. Upgrades come more often than not, and late checkout is nearly automatic. The suite line is where it thins out, and where city hotels and resorts part ways.', 'Read the odds on each hotel page before you book, and add your own stay after.'] },
  { title: 'World of Hyatt in one page (mock)', slug: 'mock-world-of-hyatt-in-one-page', category: 'guides', date: '2026-09-04', dek: 'Tiers, what each unlocks, and the two ways most people reach the top.', paras: ['Four tiers: Discoverist at 10 nights, Explorist at 30, Globalist at 60, and Lifetime Globalist after a million base points. Milestone rewards along the way are the quiet strength of the program.', 'Most readers who hold Globalist got there through a mix of paid stays and the credit card night credits, then kept it with the annual spend.', 'The program pages on this site list every hotel under each brand, with reader odds where enough stays are in.'] },
  { title: 'Are points or cash the better deal at Park Hyatt New York? (mock)', slug: 'mock-points-or-cash-park-hyatt-new-york', category: 'guides', date: '2026-08-28', dek: 'A worked example with real rates, and the value threshold where points win.', paras: ['At 45,000 points a night against cash rates that sit near $1,400, the redemption clears two cents per point on most dates. That is well above what the points cost to earn.', 'Suite awards change the maths again. A confirmed suite upgrade on a points stay at this property is one of the strongest uses in the program.', 'The lounge is the tie-breaker for many readers: it is included on both, but only Globalists and club-room guests get in.'] },
  { title: 'Which hotel card is worth the fee this year (mock)', slug: 'mock-which-hotel-card-is-worth-the-fee', category: 'credit-cards', date: '2026-08-20', dek: 'Four cards, one question: does the free night and status cover the annual fee on its own?', paras: ['The honest answer is that a free night certificate you will actually use covers the fee on all four cards. The difference is in what else comes with it.', 'Automatic mid-tier status matters most where it changes the stay: breakfast, late checkout, and a shot at a better room. On the pages here you can see how each tier fares at a given hotel.', 'We hold no card partnerships, so there is no link to click. Pick the card for the program you already stay with.'] },
  { title: 'How we rate a club lounge (mock)', slug: 'mock-how-we-rate-a-club-lounge', category: 'hotels', date: '2026-08-12', dek: 'Food, drink, space and service, each out of five, plus the only question that matters: was it worth a club room?', paras: ['Readers who used a lounge score four things from one to five and give an overall mark. They also say whether they would book a club room to get in. Those answers become the lounge score once five stays are in.', 'Access is reported separately. A lounge that prints Globalist access but turns Globalists away shows a low access-honoured rate, and that number is on the lounge page.', 'Hours, dress code and what is served are recorded as printed, so you can check whether cocktail hour lines up with your evening.'] },
  { title: 'Five city hotels where the suite upgrade actually happens (mock)', slug: 'mock-five-city-hotels-suite-upgrade', category: 'hotels', date: '2026-08-02', dek: 'Ranked by reader-reported suite rate, not by our opinion.', paras: ['Every hotel on this site shows how often top-tier guests got a suite, once enough stays are reported. These five lead the city list.', 'The pattern is clear: newer builds with a deep suite inventory upgrade far more often than grand old houses with twelve suites and a waiting list.', 'Check the hotel page for the current figure before you book. The numbers move as more stays come in.'] },
]

function paragraphs(paras: string[]) {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr' as const,
      children: paras.map((t) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr' as const, textFormat: 0, textStyle: '', children: [{ type: 'text', text: t, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] })),
    },
  }
}

async function seedArticles(payload: Payload) {
  let n = 0
  for (const a of MOCK_ARTICLES) {
    const exists = await payload.count({ collection: 'articles', where: { slug: { equals: a.slug } }, overrideAccess: true })
    if (exists.totalDocs) continue
    await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: { title: a.title, slug: a.slug, categories: [a.category], publishedDate: a.date, dek: a.dek, body: paragraphs(a.paras), featured: n === 0, _status: 'published' } as never,
    })
    n++
  }
  console.log(`seed-articles: created ${n} mock articles`)
}

async function unseedArticles(payload: Payload) {
  const res = await payload.delete({ collection: 'articles', where: { slug: { like: 'mock-' } }, overrideAccess: true })
  console.log(`unseed-articles: removed ${res.docs.length} mock articles`)
}

// ---- Real articles -----------------------------------------------------------------
// Each file in data/articles is one article: YAML-ish front matter, then a
// markdown subset. Blocks are separated by blank lines: ## and ### headings,
// paragraphs, - bullets, 1. numbered lists, > blockquotes (one paragraph),
// --- rules, tables with a header row and a |---| separator row, and images
// ![alt](source "stored-filename") followed on the next line by an optional
// *Caption. Photo: Credit.* line. Inline: **bold**, *italic*, [text](url).
// Upserted by slug and published.
//
// An image source is a URL or a path relative to data/articles: photos
// shipped with the repo live in data/articles/images/<slug>/ and are
// written as images/<slug>/name.jpg. The stored filename is the name of the
// media doc, looked up by name on every run, so it should be unique across
// articles (two articles each shipping a vail.jpg would otherwise share one
// media doc); prefix it with the article slug.

// An image the body (or the hero front matter line) refers to. src is the
// download URL or the path relative to data/articles, filename the name it
// is stored under in Media.
export type ArticleImage = { src: string; filename: string; alt: string; caption: string; credit: string }

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ![alt](src "stored-filename"); without a title the file is named after the
// last segment of the URL. Null when the line is not an image.
export function parseMarkdownImage(line: string): { src: string; alt: string; filename: string } | null {
  const m = IMAGE_LINE.exec(line.trim())
  if (!m) return null
  let filename = (m[3] ?? '').trim()
  if (!filename) {
    try {
      filename = decodeURIComponent(path.posix.basename(new URL(m[2]).pathname))
    } catch {
      filename = path.posix.basename(m[2].split(/[?#]/)[0])
    }
  }
  return { src: m[2], alt: m[1].trim(), filename }
}

// *Caption text. Photo: Credit.* -> caption (keeps its trailing period) and
// credit (trailing period removed). No "Photo:" means no credit. Null when
// the line is not a single-asterisk italic line.
export function parseImageCaption(line: string): { caption: string; credit: string } | null {
  const m = /^\*(?!\*)(.+)\*$/.exec(line.trim())
  if (!m) return null
  const inner = m[1].trim()
  const at = inner.indexOf('Photo:')
  if (at < 0) return { caption: inner, credit: '' }
  return { caption: inner.slice(0, at).trim(), credit: inner.slice(at + 'Photo:'.length).trim().replace(/\.$/, '') }
}

type TableData = { header: string[] | null; rows: string[][] }

const isPipeRow = (l: string) => l.startsWith('|')
const isSeparatorRow = (l: string) => /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && l.includes('-')
const splitRow = (l: string): string[] => {
  let s = l.trim().replace(/\\\|/g, '\u0000')
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim().replace(/\u0000/g, '|'))
}

// A chunk (the text between blank lines) holds several blocks when the author
// skipped a blank line: a heading on its own line, or table rows touching
// text. Splits after a heading line and where pipe rows meet other lines.
const splitChunk = (raw: string[]): string[][] => {
  const parts: string[][] = []
  let cur: string[] = []
  let pipes = false
  for (const line of raw) {
    const l = line.trim()
    const heading = /^#{2,3}\s+\S/.test(l)
    const pipe = isPipeRow(l)
    if (cur.length && (heading || pipe !== pipes)) {
      parts.push(cur)
      cur = []
    }
    if (heading) {
      parts.push([line])
      pipes = false
      continue
    }
    pipes = pipe
    cur.push(line)
  }
  if (cur.length) parts.push(cur)
  return parts
}

// images collects every image the body refers to, in order; warn is told
// about text that looks like markup the converter did not recognise.
export function markdownToHtml(md: string, images: ArticleImage[] = [], warn: (message: string) => void = () => {}): string {
  const inline = (t: string) =>
    t
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  const image = (img: { src: string; alt: string; filename: string }, caption: { caption: string; credit: string } | null) => {
    const a: ArticleImage = { src: img.src, filename: img.filename, alt: img.alt, caption: caption?.caption ?? '', credit: caption?.credit ?? '' }
    images.push(a)
    return `<img src="${escapeAttr(a.src)}" alt="${escapeAttr(a.alt)}" title="${escapeAttr(a.filename)}" data-caption="${escapeAttr(a.caption)}" data-credit="${escapeAttr(a.credit)}">`
  }
  const renderTable = (t: TableData) => {
    const cols = Math.max(t.header?.length ?? 0, ...t.rows.map((r) => r.length))
    const pad = (r: string[]) => [...r, ...Array<string>(Math.max(0, cols - r.length)).fill('')]
    const cells = (r: string[], tag: 'th' | 'td') => `<tr>${pad(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`
    const head = t.header ? `<thead>${cells(t.header, 'th')}</thead>` : ''
    return `<table>${head}<tbody>${t.rows.map((r) => cells(r, 'td')).join('')}</tbody></table>`
  }
  const out: (string | TableData)[] = []
  for (const part of md.split(/\n\s*\n/).flatMap((chunk) => splitChunk(chunk.split('\n')))) {
    const block = part.join('\n').trim()
    if (!block) continue
    const h = /^(#{2,3})\s+(.+)$/.exec(block)
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
      continue
    }
    const lines = block.split('\n').map((l) => l.trim())
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      out.push('<hr>')
      continue
    }
    // a quote opens with "> "; a bare ">" before text, as in ">50%", is text
    if (/^>(\s|$)/.test(lines[0])) {
      out.push(`<blockquote>${inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' ').trim())}</blockquote>`)
      continue
    }
    if (lines.every(isPipeRow)) {
      const rows = lines.map(splitRow)
      if (lines.length >= 2 && isSeparatorRow(lines[1])) {
        out.push({ header: rows[0], rows: rows.slice(2) })
        continue
      }
      // rows with no header: a table continued after a stray blank line, or a header-less table
      const prev = out[out.length - 1]
      if (prev && typeof prev === 'object') prev.rows.push(...rows)
      else out.push({ header: null, rows })
      continue
    }
    if (lines.some((l) => IMAGE_LINE.test(l))) {
      // images, each with an optional caption on the next line; other lines
      // around them form a paragraph
      let text: string[] = []
      const flush = () => {
        if (text.length) out.push(`<p>${inline(text.join(' '))}</p>`)
        text = []
      }
      for (let i = 0; i < lines.length; i++) {
        const img = parseMarkdownImage(lines[i])
        if (!img) {
          text.push(lines[i])
          continue
        }
        flush()
        const caption = i + 1 < lines.length ? parseImageCaption(lines[i + 1]) : null
        if (caption) i++
        out.push(image(img, caption))
      }
      flush()
      continue
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`)
      continue
    }
    if (block.split('\n').every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${block.split('\n').map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (lines.some((l) => l.includes('|') && isSeparatorRow(l))) warn(`paragraph looks like a table: ${lines[0].slice(0, 60)}`)
    out.push(`<p>${inline(block.replace(/\n/g, ' '))}</p>`)
  }
  return out.map((o) => (typeof o === 'string' ? o : renderTable(o))).join('\n')
}

// Phrasing that reads like a note a writing or research tool left in the
// copy, not like an editor. Case-insensitive; a phrase matches as whole
// words, a RegExp as written (a bracketed instruction such as [Insert photo]).
// Kept narrow on purpose: ordinary English ("a mock Tudor facade", "this run
// of storms", "the date is TBD") and newsroom forms ("[Update: ...]",
// "[Editor's note: ...]") must not warn, since a warning invites a rewrite.
export const TOOL_NOTE_PATTERNS: readonly (string | RegExp)[] = [
  /\b(?:verified|confirmed|checked|found)\s+(?:in|during)\s+this\s+(?:run|session)\b/i,
  /\b(?:verified|confirmed|checked)\s+this\s+(?:run|session)\s*:/i,
  /\bas\s+of\s+this\s+(?:run|session)\b/i,
  'research stream',
  'publish pack',
  'suggested headline',
  'suggested slug',
  /\bdek\s*:/i,
  'as an ai',
  'language model',
  'per the prompt',
  'per the brief',
  /\bnote\s+to\s+(?:the\s+)?editors?\b/i,
  /\b(?:say\s+so\s+to\s+readers(?:\s+rather\s+than\s+padding)?|rather\s+than\s+padding)\b/i,
  'placeholder',
  'todo',
  /\bmock\s+(?:article|draft|copy|headline|story)\b/i,
  'lorem ipsum',
  '[citation needed]',
  /\binsert\s+(?:an?\s+|the\s+)?(?:photo|image|picture|link|quote|chart|table|caption|credit|here)\b/i,
  /\$\s?X{2,}\b/i,
  'used for discovery',
  'citation source',
  /\[\s*(?:add|insert|link|confirm|check|verify|fill|cite|source|photo|image|caption|credit|tk|tbd|todo|placeholder|citation|needs?|replace|write|expand)\b[^\]\n]*\]/gi,
]

const toolNoteRegExps = TOOL_NOTE_PATTERNS.map((p) => {
  if (p instanceof RegExp) return new RegExp(p.source, 'gi')
  const body = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+')
  return new RegExp(`${/^\w/.test(p) ? '(?<!\\w)' : ''}${body}${/\w$/.test(p) ? '(?!\\w)' : ''}`, 'gi')
})

// Each spot in an article's words (title, dek, search title and description,
// hero alt text and credit, and the body with its table cells and captions)
// that matches a pattern, with up to 30 characters either side. Link and
// image addresses and photo file names are not words, so they are left out.
export function toolNotes(body: string, meta: Record<string, string | undefined> = {}): string[] {
  const fields = [meta.title, meta.dek, meta.metaTitle, meta.metaDescription, meta.hero, meta.heroCredit, body]
  const notes: string[] = []
  for (const field of fields) {
    if (!field) continue
    const words = field
      .replace(/!?\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\s*\)/g, ' $1 ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\*+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const hits: { start: number; end: number }[] = []
    for (const re of toolNoteRegExps) for (const m of words.matchAll(re)) hits.push({ start: m.index, end: m.index + m[0].length })
    hits.sort((a, b) => a.start - b.start || b.end - a.end)
    let last = -1
    for (const { start, end } of hits) {
      if (start < last) continue // inside a longer hit, such as "in this run" in "verified in this run"
      last = end
      const from = Math.max(0, start - 30)
      const to = Math.min(words.length, end + 30)
      notes.push(`${from > 0 ? '...' : ''}${words.slice(from, to).trim()}${to < words.length ? '...' : ''}`)
    }
  }
  return notes
}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' }
const mimeFromName = (name: string) => MIME_BY_EXT[path.extname(name).slice(1).toLowerCase()] ?? 'image/jpeg'

// Downloads an image. A failure with a query string in the URL is retried
// once without it (Wikimedia's ?width= thumbnails are the usual case). A
// response that is not an image (a page served with 200, say) is a failure
// too. filename supplies the type when the server names none.
export async function fetchImage(src: string, filename = ''): Promise<{ data: Buffer; mimetype: string } | { error: string }> {
  const attempt = async (url: string) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'LoyalistTravel/1.0 (+https://loyalisttravel.com)' }, redirect: 'follow', signal: AbortSignal.timeout(60000) })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      const mimetype = res.headers.get('content-type')?.split(';')[0].trim() || mimeFromName(filename || url.split(/[?#]/)[0])
      if (!mimetype.startsWith('image/')) return { error: `not an image (${mimetype})` }
      const data = Buffer.from(await res.arrayBuffer())
      return { data, mimetype }
    } catch (err) {
      // Node wraps network errors as "fetch failed" with the reason in cause
      const cause = (err as { cause?: { message?: string } })?.cause?.message
      return { error: err instanceof Error ? [err.message, cause].filter(Boolean).join(': ') : String(err) }
    }
  }
  const first = await attempt(src)
  if (!('error' in first)) return first
  const q = src.indexOf('?')
  if (q < 0) return first
  const second = await attempt(src.slice(0, q))
  return 'error' in second ? { error: `${first.error}; retry without query: ${second.error}` } : second
}

// The markdown files, and under images/<slug>/ the photos they ship with.
const articlesDir = () => path.join(process.cwd(), 'data', 'articles')

const isHttpUrl = (src: string) => /^https?:\/\//i.test(src)

// The real path of p (symlinks followed), '' when it does not exist.
const realPath = (p: string) => {
  try {
    return fs.realpathSync(p)
  } catch {
    return ''
  }
}

// The path of abs inside dir with / separators; null when abs is dir itself
// or lies outside it.
const within = (dir: string, abs: string): string | null => {
  const rel = path.relative(dir, abs)
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}

// A source that is not a URL is a path relative to data/articles. Where it
// is on disk, with the relative path for log lines; null when it points
// outside that folder: an absolute path, one that climbs out with .., or a
// symlink whose target is outside. A path that does not exist yet passes
// and is reported as missing by the caller.
export function localArticleImage(src: string): { abs: string; rel: string } | null {
  const dir = articlesDir()
  const abs = path.resolve(dir, src)
  const rel = within(dir, abs)
  if (rel === null) return null
  const real = realPath(abs)
  if (real && within(realPath(dir), real) === null) return null
  return { abs, rel }
}

// A source that starts with / is a file the site serves itself, from
// public/ (photos shipped with an article live in public/images/articles/
// <slug>/). Where it is on disk; null when it points outside public/.
const publicDir = () => path.join(process.cwd(), 'public')
export const isSitePath = (src: string) => src.startsWith('/') && !src.startsWith('//')
export function siteImage(src: string): { abs: string; rel: string } | null {
  const dir = publicDir()
  const abs = path.resolve(dir, '.' + decodeURI(src.split(/[?#]/)[0]))
  const rel = within(dir, abs)
  if (rel === null) return null
  const real = realPath(abs)
  if (real && within(realPath(dir), real) === null) return null
  return { abs, rel: `public/${rel}` }
}

// What a run has resolved so far, by stored filename, with the source that
// produced it.
type MediaCache = Map<string, { id: number | null; src: string }>

// The Media id for an article image. A media doc already stored under the
// filename is reused as is; otherwise the bytes come from
// ARTICLE_IMAGE_DIR/<filename> when that is set and present (local runs
// without network), else from the source: downloaded when it is an http(s)
// URL, read from public/ for a site path (/images/...), read from
// data/articles/<path> otherwise. A media doc is created. A photo the site
// serves itself keeps that path in the doc's staticUrl, which is what the
// pages show, so it never depends on where the uploaded copy is stored.
// Null when none of these works (a path outside its folder is refused), so
// the article still imports without the image.
// On a GitHub runner without the Blob token, an uploaded copy lands on the
// runner's own disk and is gone when the job ends. A photo the site serves
// itself is unaffected; any other photo is skipped there.
export function photosUnavailable(): boolean {
  return Boolean(process.env.GITHUB_ACTIONS) && !process.env.BLOB_READ_WRITE_TOKEN
}
const PHOTOS_SKIPPED = 'photos from other sites skipped: BLOB_READ_WRITE_TOKEN is not set, so a copy uploaded from this runner would be lost with it. Ship the photo under public/images/articles/ instead.'

export async function resolveArticleImage(payload: Payload, file: string, img: ArticleImage, cache: MediaCache): Promise<number | null> {
  if (!img.filename) {
    console.log(`articles: ${file}: image ${img.src} skipped (no stored filename)`)
    return null
  }
  const hit = cache.get(img.filename)
  if (hit) {
    if (hit.src !== img.src) console.log(`articles: ${file}: warning: ${img.filename} was resolved from ${hit.src}; ${img.src} shares that media doc`)
    return hit.id
  }
  const resolve = async (): Promise<number | null> => {
    const site = isSitePath(img.src) ? siteImage(img.src) : null
    if (isSitePath(img.src) && !site) {
      console.log(`articles: ${file}: image ${img.filename} skipped (outside public)`)
      return null
    }
    const staticUrl = site ? img.src : null
    const existing = (await payload.find({ collection: 'media', where: { filename: { equals: img.filename } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (existing) {
      if (staticUrl && existing.staticUrl !== staticUrl) {
        await payload.update({ collection: 'media', id: existing.id, data: { staticUrl }, overrideAccess: true })
        console.log(`articles: ${file}: media ${img.filename} reused (id ${existing.id}), now served from ${staticUrl}`)
      } else console.log(`articles: ${file}: media ${img.filename} reused (id ${existing.id})`)
      return existing.id
    }
    let data: Buffer
    let mimetype: string
    let from: string
    const dir = process.env.ARTICLE_IMAGE_DIR
    const local = dir ? path.join(dir, img.filename) : null
    if (local && fs.existsSync(local)) {
      data = fs.readFileSync(local)
      mimetype = mimeFromName(img.filename)
      from = 'ARTICLE_IMAGE_DIR'
    } else if (isHttpUrl(img.src)) {
      const got = await fetchImage(img.src, img.filename)
      if ('error' in got) {
        console.log(`articles: ${file}: image ${img.filename} skipped (${got.error})`)
        return null
      }
      data = got.data
      mimetype = got.mimetype
      from = img.src
    } else if (site) {
      if (!fs.statSync(site.abs, { throwIfNoEntry: false })?.isFile()) {
        console.log(`articles: ${file}: image ${img.filename} skipped (file not found: ${site.rel})`)
        return null
      }
      data = fs.readFileSync(site.abs)
      mimetype = mimeFromName(site.abs)
      from = site.rel
    } else {
      const shipped = localArticleImage(img.src)
      if (!shipped) {
        console.log(`articles: ${file}: image ${img.filename} skipped (outside data/articles)`)
        return null
      }
      if (!fs.statSync(shipped.abs, { throwIfNoEntry: false })?.isFile()) {
        console.log(`articles: ${file}: image ${img.filename} skipped (file not found: ${shipped.rel})`)
        return null
      }
      data = fs.readFileSync(shipped.abs)
      mimetype = mimeFromName(shipped.abs)
      from = shipped.rel
    }
    // no media doc has the name (checked above), so a stray file left on
    // disk is overwritten rather than the name being suffixed
    let media: Media
    try {
      media = await payload.create({
        collection: 'media',
        data: { alt: img.alt || img.caption || img.filename, credit: img.credit || null, staticUrl },
        file: { data, mimetype, name: img.filename, size: data.length },
        overrideAccess: true,
        overwriteExistingFiles: true,
      })
    } catch (err) {
      console.log(`articles: ${file}: image ${img.filename} skipped (${err instanceof Error ? err.message : String(err)})`)
      return null
    }
    console.log(`articles: ${file}: media ${media.filename} created (${data.length} bytes, from ${from})`)
    if (media.filename !== img.filename) console.log(`articles: ${file}: warning: stored as ${media.filename}, not ${img.filename}; the next run will not find it by name`)
    return media.id
  }
  const id = await resolve()
  cache.set(img.filename, { id, src: img.src })
  return id
}

// ---- Article words and photos ------------------------------------------------
type LexNode = { type?: string; text?: string; value?: unknown; children?: LexNode[] }
type LexDoc = { root: { children: LexNode[] } }

// The words of a Lexical node or document, spaces normalised.
export function lexicalText(node: unknown): string {
  const walk = (n: LexNode): string => (n.type === 'text' ? (n.text ?? '') : (n.children ?? []).map(walk).join(' '))
  const start = (node as { root?: LexNode } | null)?.root ?? (node as LexNode | null) ?? {}
  return walk(start).replace(/\s+/g, ' ').trim()
}

// A fingerprint of an article's words: title, dek and body text. Photos
// carry no words, so adding or moving one does not change it.
export const articleWordsHash = (title: unknown, dek: unknown, body: unknown) =>
  createHash('sha256').update(JSON.stringify([String(title ?? ''), String(dek ?? ''), lexicalText(body)])).digest('hex').slice(0, 32)

// The settings the import writes besides the words. Their fingerprint rides
// after the words' in importedHash ("<words>.<settings>"), so settings
// changed in the admin can be told apart from the file's, separately from
// the words. A fingerprint from before this has the words part only.
type ArticleSettings = { categories?: string[] | null; heroImage?: unknown; featured?: boolean | null; seo?: { title?: string | null; description?: string | null } | null }
const SETTING_NAMES: Record<keyof ArticleSettings, string> = { categories: 'categories', heroImage: 'hero', featured: 'featured', seo: 'search title and description' }
const settingValue = (a: ArticleSettings, k: keyof ArticleSettings) => {
  if (k === 'heroImage') return a.heroImage && typeof a.heroImage === 'object' ? ((a.heroImage as { id?: unknown }).id ?? null) : (a.heroImage ?? null)
  if (k === 'categories') return a.categories ?? []
  if (k === 'featured') return Boolean(a.featured)
  return [a.seo?.title || null, a.seo?.description || null]
}
const settingsOf = (a: ArticleSettings) => (Object.keys(SETTING_NAMES) as (keyof ArticleSettings)[]).map((k) => settingValue(a, k))
export const articleSettingsHash = (a: ArticleSettings) => createHash('sha256').update(JSON.stringify(settingsOf(a))).digest('hex').slice(0, 16)
const wordsPart = (h: string | null | undefined) => (h ?? '').split('.')[0]
const settingsPart = (h: string | null | undefined) => (h ?? '').split('.')[1] ?? ''
// A third part fingerprints what the import read: the markdown file and the
// photos and related pages it resolved to. While that and the saved article
// are both unchanged, there is nothing to write, so the article is not
// saved again (each save would show readers a new "Updated" date).
const sourcePart = (h: string | null | undefined) => (h ?? '').split('.')[2] ?? ''

const uploadId = (n: LexNode) => (n.value && typeof n.value === 'object' ? (n.value as { id?: unknown }).id : n.value)

// Puts the photos of an imported body into a stored one that was edited in
// the admin, without touching its words: each missing photo goes right after
// the block it followed in the import (matched by its words), or failing
// that right before the block it preceded. Photos whose neighbours are both
// gone are left out and named.
export function mergePhotos(stored: LexDoc, imported: LexDoc, removed: ReadonlySet<number> = new Set()): { body: LexDoc; added: number; missed: number[]; left: number[] } {
  const body = structuredClone(stored)
  const nodes = body.root.children
  const have = new Set(nodes.filter((n) => n.type === 'upload').map(uploadId))
  const inc = imported.root.children
  const words = (n: LexNode) => (n.type === 'upload' ? '' : lexicalText(n))
  const find = (text: string) => (text ? nodes.findIndex((n) => n.type !== 'upload' && words(n) === text) : -1)
  let added = 0
  const missed: number[] = []
  const left: number[] = []
  inc.forEach((n, i) => {
    if (n.type !== 'upload' || have.has(uploadId(n))) return
    // taken out in the admin: an editor's choice, not something to undo
    if (removed.has(Number(uploadId(n)))) {
      left.push(Number(uploadId(n)))
      return
    }
    let before = ''
    for (let k = i - 1; k >= 0 && !before; k--) before = words(inc[k])
    let after = ''
    for (let k = i + 1; k < inc.length && !after; k++) after = words(inc[k])
    let at = find(before)
    if (at >= 0) {
      at += 1
      // keep photos that already follow the same block in their order
      while (at < nodes.length && nodes[at].type === 'upload') at++
    } else at = find(after)
    if (at < 0) {
      missed.push(Number(uploadId(n)))
      return
    }
    nodes.splice(at, 0, structuredClone(n))
    have.add(uploadId(n))
    added++
  })
  return { body, added, missed, left }
}

// Every photo an article has carried in any saved version.
const photosEver = (versions: { version?: { body?: unknown } }[]) =>
  new Set(versions.flatMap((d) => ((d.version?.body as LexDoc | undefined)?.root?.children ?? []).filter((n) => n.type === 'upload').map((n) => Number(uploadId(n)))))

// The newest saved version, when it is a draft nobody has published yet.
async function unpublishedDraft(payload: Payload, id: number) {
  const newest = (await payload.findVersions({ collection: 'articles', where: { parent: { equals: id } }, sort: '-updatedAt', limit: 1, depth: 0, overrideAccess: true })).docs[0] as { updatedAt?: string; version?: { _status?: string } } | undefined
  return newest?.version?._status === 'draft' ? newest : null
}

// articles-force: overwrite even articles edited in the admin
let forceArticles = false

async function importArticles(payload: Payload) {
  const dir = articlesDir()
  if (!fs.existsSync(dir)) return
  let n = 0
  let kept = 0
  let waiting = 0
  let unchanged = 0
  const mediaCache: MediaCache = new Map()
  // without a place to store uploads, only photos the site serves itself
  const canStore = !photosUnavailable()
  const usable = (src: string) => canStore || isSitePath(src)
  let warned = false
  const skipNote = (src: string) => {
    if (usable(src) || warned) return
    warned = true
    console.log(`articles: ${PHOTOS_SKIPPED}`)
  }
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
    if (!m) throw new Error(`articles: ${file} has no front matter`)
    const meta: Record<string, string> = {}
    for (const line of m[1].split('\n')) {
      const kv = /^(\w+):\s*(.*)$/.exec(line)
      if (kv) meta[kv[1]] = kv[2].trim()
    }
    for (const k of ['title', 'slug', 'date']) if (!meta[k]) throw new Error(`articles: ${file} is missing ${k}`)
    // "categories:" means the same as "category:". Either takes one value or
    // a comma list; the first is the main category.
    if (meta.category && meta.categories) throw new Error(`articles: ${file} has both category and categories; keep one`)
    const categories = [...new Set((meta.category || meta.categories || '').split(',').map((c) => c.trim()).filter(Boolean))]
    if (!categories.length) throw new Error(`articles: ${file} is missing category`)
    for (const c of categories) if (!ARTICLE_CATEGORIES.some((o) => o.value === c)) throw new Error(`articles: ${file} has unknown category ${c}; expected one of ${ARTICLE_CATEGORIES.map((o) => o.value).join(', ')}`)
    // a warning only: the article still imports
    for (const note of toolNotes(m[2], meta)) console.log(`articles: ${file}: reads like a tool note: "${note}"`)

    // images first, so the body can point at their media ids
    const images: ArticleImage[] = []
    const html = markdownToHtml(m[2], images, (message) => console.log(`articles: ${file}: ${message}`))
    const uploads = new Map<string, number>()
    let heroId: number | null = null
    let heroLost = false
    for (const img of images) {
      skipNote(img.src)
      if (!usable(img.src)) continue
      const id = await resolveArticleImage(payload, file, img, mediaCache)
      if (id != null) uploads.set(img.src, id)
    }
    if (meta.hero) {
      const hero = parseMarkdownImage(meta.hero)
      if (!hero) console.log(`articles: ${file}: hero is not an image line, ignored`)
      else if (usable(hero.src)) heroId = await resolveArticleImage(payload, file, { ...hero, caption: '', credit: meta.heroCredit ?? '' }, mediaCache)
      else {
        skipNote(hero.src)
        heroLost = true
      }
    }
    const converted = htmlToLexical(html, { uploads })
    if (canStore) droppedImages.push(...converted.droppedImages)
    const body = converted.value
    if (!body) throw new Error(`articles: ${file} has an empty body`)

    const programs: number[] = []
    for (const slug of (meta.programs ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const p = (await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
      if (p) programs.push(p.id)
      else console.log(`articles: ${file} names unknown program ${slug}`)
    }
    const related: number[] = []
    for (const slug of (meta.articles ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const a = (await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
      if (a) related.push(a.id)
      else console.log(`articles: ${file} names unknown article ${slug}`)
    }
    const data = {
      title: meta.title,
      slug: meta.slug,
      categories,
      publishedDate: meta.date,
      dek: meta.dek || null,
      body,
      featured: meta.featured === 'true',
      related: { programs, articles: related },
      seo: { title: meta.metaTitle || null, description: meta.metaDescription || null },
      // set when the hero resolved, cleared when it had to be skipped (a
      // leftover hero would point at a lost file), otherwise left alone
      ...(heroId != null ? { heroImage: heroId } : heroLost ? { heroImage: null } : {}),
      _status: 'published',
    }
    const importedHash = articleWordsHash(data.title, data.dek, body)
    const source = createHash('sha256').update(JSON.stringify([raw, [...uploads.entries()], heroId, heroLost, data.related])).digest('hex').slice(0, 16)
    const existing = (await payload.find({ collection: 'articles', where: { slug: { equals: meta.slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (existing) {
      // a draft saved in the admin and not published yet is work in
      // progress; writing now would publish over it
      const draft = forceArticles ? null : await unpublishedDraft(payload, existing.id)
      if (draft) {
        console.log(`articles: ${file}: has a draft saved in the admin ${String(draft.updatedAt).slice(0, 16)} that is not published yet, so it is left alone until it is published`)
        waiting++
        continue
      }
      // a photo the article carried in an earlier version and does not now
      // was taken out in the admin, so the import does not put it back
      const history = await payload.findVersions({ collection: 'articles', where: { parent: { equals: existing.id } }, limit: 100, depth: 0, overrideAccess: true })
      const current = photosEver([{ version: { body: existing.body } }])
      const taken = new Set([...photosEver(history.docs as { version?: { body?: unknown } }[])].filter((id) => !current.has(id)))
      // Words edited in the admin since the last import are kept: the stored
      // words no longer match what the import wrote (or, before fingerprints
      // existed, what it would write now).
      const storedHash = articleWordsHash(existing.title, existing.dek, existing.body)
      const lastWords = wordsPart(existing.importedHash)
      const edited = lastWords ? storedHash !== lastWords : storedHash !== importedHash
      // Settings are kept the same way, on their own: the file's apply unless
      // the saved ones no longer match what the import last set. Before
      // settings had a fingerprint, the hero, featured flag and search text
      // the admin holds are kept; categories come from the file, since the
      // admin could not hold more than one until now.
      const fromFile: ArticleSettings = { categories, heroImage: 'heroImage' in data ? data.heroImage : existing.heroImage, featured: data.featured, seo: data.seo }
      const keys = Object.keys(SETTING_NAMES) as (keyof ArticleSettings)[]
      const differs = (k: keyof ArticleSettings) => JSON.stringify(settingValue(existing, k)) !== JSON.stringify(settingValue(fromFile, k))
      const lastSettings = settingsPart(existing.importedHash)
      const keep = forceArticles
        ? []
        : lastSettings
          ? articleSettingsHash(existing) !== lastSettings ? keys.filter(differs) : []
          : keys.filter((k) => k !== 'categories' && differs(k) && JSON.stringify(settingValue(existing, k)) !== JSON.stringify(settingValue({}, k)))
      const settings = Object.fromEntries(keys.map((k) => [k, keep.includes(k) ? existing[k] : fromFile[k]])) as ArticleSettings
      if (keep.length) console.log(`articles: ${file}: settings changed in the admin are kept (${keep.map((k) => SETTING_NAMES[k]).join(', ')}); the file's are not applied. Run articles-force to overwrite them from ${file}.`)
      const had = (existing.categories ?? []).join(', ')
      if (!keep.includes('categories') && had !== categories.join(', ')) console.log(`articles: ${file}: categories set to ${categories.join(', ')} from the file (they were ${had || 'empty'})`)
      // what the import would set, so the next run can tell an admin change
      const settingsHash = articleSettingsHash(fromFile)
      if (edited && !forceArticles) {
        const merged = mergePhotos(existing.body as unknown as LexDoc, body as unknown as LexDoc, taken)
        const hash = `${lastWords}.${settingsHash}.${source}`
        const changed = merged.added > 0 || keys.some((k) => JSON.stringify(settingValue(existing, k)) !== JSON.stringify(settingValue(settings, k))) || hash !== existing.importedHash
        if (changed) {
          await payload.update({ collection: 'articles', id: existing.id, data: { body: merged.body, ...settings, importedHash: hash, _status: 'published' } as never, overrideAccess: true })
        }
        console.log(`articles: ${file}: edited in the admin since the last import, so its words are left as they are; ${merged.added} photo(s) added${merged.left.length ? `; ${merged.left.length} photo(s) left out, taken out in the admin (media ${merged.left.join(', ')})` : ''}${merged.missed.length ? `; ${merged.missed.length} photo(s) not placed, their sections are gone (media ${merged.missed.join(', ')})` : ''}. Run articles-force to overwrite it from ${file}.`)
        // the words on the site are the admin's, so they are the ones to check
        const seo = existing.seo
        for (const note of toolNotes(lexicalText(existing.body), { title: existing.title, dek: existing.dek ?? undefined, metaTitle: seo?.title ?? undefined, metaDescription: seo?.description ?? undefined })) {
          console.log(`articles: ${file}: the words saved in the admin read like a tool note: "${note}"`)
        }
        kept++
        continue
      }
      // the file and the saved article are as the last import left them
      if (!forceArticles && sourcePart(existing.importedHash) === source && storedHash === importedHash) {
        unchanged++
        continue
      }
      if (!forceArticles && taken.size) {
        const doc = body as unknown as LexDoc
        const left = doc.root.children.filter((c) => c.type === 'upload' && taken.has(Number(uploadId(c)))).map((c) => Number(uploadId(c)))
        doc.root.children = doc.root.children.filter((c) => !(c.type === 'upload' && taken.has(Number(uploadId(c)))))
        if (left.length) console.log(`articles: ${file}: ${left.length} photo(s) left out, taken out in the admin (media ${left.join(', ')})`)
      }
      await payload.update({ collection: 'articles', id: existing.id, data: { ...data, ...settings, importedHash: `${importedHash}.${settingsHash}.${source}` } as never, overrideAccess: true })
    } else {
      const settingsHash = articleSettingsHash({ categories, heroImage: 'heroImage' in data ? data.heroImage : null, featured: data.featured, seo: data.seo })
      await payload.create({ collection: 'articles', data: { ...data, importedHash: `${importedHash}.${settingsHash}.${source}` } as never, overrideAccess: true })
    }
    n++
  }
  console.log(`articles: upserted ${n} article(s)${unchanged ? `, ${unchanged} unchanged since the last import` : ''}${kept ? `, kept the words of ${kept} edited in the admin` : ''}${waiting ? `, left ${waiting} with an unpublished draft alone` : ''}`)
}

async function forceImportArticles(payload: Payload) {
  forceArticles = true
  await importArticles(payload)
}

// Re-creates every photo the articles refer to: the media records are
// deleted by filename and the articles imported again, so each record is
// made afresh from its source. Without a place to store uploads, only
// photos the site serves itself are redone; the rest are left as they are.
async function refreshArticleImages(payload: Payload) {
  const canStore = !photosUnavailable()
  const dir = articlesDir()
  if (!fs.existsSync(dir)) return
  const filenames = new Set<string>()
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
    if (!m) continue
    const images: ArticleImage[] = []
    markdownToHtml(m[2], images)
    const heroLine = m[1].split('\n').find((l) => /^hero:\s*/.test(l))
    const hero = heroLine ? parseMarkdownImage(heroLine.replace(/^hero:\s*/, '')) : null
    for (const img of hero ? [...images, hero] : images) {
      if (!img.filename) continue
      if (canStore || isSitePath(img.src)) filenames.add(img.filename)
      else console.log(`articles-refresh: ${img.filename} left as it is (${PHOTOS_SKIPPED})`)
    }
  }
  if (filenames.size) {
    const res = await payload.delete({ collection: 'media', where: { filename: { in: Array.from(filenames) } }, overrideAccess: true })
    console.log(`articles-refresh: removed ${res.docs.length} of ${filenames.size} photo record(s)`)
  }
  await importArticles(payload)
}

// Read-only: what each article holds, as stored and as the site reads it
// (published version, photos resolved), to tell a stale page from missing
// data.
async function reportArticles(payload: Payload) {
  const all = await payload.find({ collection: 'articles', limit: 100, depth: 0, draft: true, overrideAccess: true, sort: 'slug' })
  for (const a of all.docs) {
    const nodes = ((a.body as { root?: { children?: { type?: string; value?: unknown }[] } } | null)?.root?.children ?? []).filter((n) => n.type === 'upload')
    const pub = (await payload.find({ collection: 'articles', where: { slug: { equals: a.slug } }, limit: 1, depth: 2, overrideAccess: true })).docs[0]
    const pubNodes = ((pub?.body as { root?: { children?: { type?: string; value?: unknown }[] } } | null)?.root?.children ?? []).filter((n) => n.type === 'upload')
    const populated = pubNodes.filter((n) => n.value && typeof n.value === 'object')
    const withAddress = populated.filter((n) => { const v = n.value as { staticUrl?: string | null; url?: string | null }; return Boolean(v.staticUrl || v.url) })
    const hero = pub?.heroImage && typeof pub.heroImage === 'object' ? (pub.heroImage as { filename?: string; staticUrl?: string | null }) : null
    const versions = await payload.countVersions({ collection: 'articles', where: { parent: { equals: a.id } }, overrideAccess: true })
    // the published categories, as the site shows them, and a draft's when it differs
    const cats = (doc?: { categories?: string[] | null }) => (doc?.categories ?? []).join(', ') || 'none'
    const categories = pub ? `${cats(pub)}${cats(a) !== cats(pub) ? ` (draft: ${cats(a)})` : ''}` : `none published (draft: ${cats(a)})`
    console.log(`articles-report: ${a.slug}: categories ${categories}, status ${a._status ?? '?'}, updated ${String(a.updatedAt).slice(0, 16)}, ${versions.totalDocs} version(s); latest draft ${nodes.length} photo node(s); published ${pub ? `${pubNodes.length} photo node(s), ${populated.length} resolved, ${withAddress.length} with an address; hero ${hero ? `${hero.filename} -> ${hero.staticUrl ?? '(no static url)'}` : 'none'}` : 'NOT FOUND'}`)
  }
  // what the last save changed in the words, against the version before it
  const textOf = lexicalText
  for (const a of all.docs) {
    // against the newest version saved more than two minutes before the last
    // (one save from the admin can write a draft and a published version)
    const v = await payload.findVersions({ collection: 'articles', where: { parent: { equals: a.id } }, sort: '-updatedAt', limit: 10, depth: 0, overrideAccess: true })
    const docs = v.docs as { updatedAt: string; version: { body?: unknown; title?: string; dek?: string | null } }[]
    const last = docs[0]
    const prev = last && docs.find((d) => Date.parse(last.updatedAt) - Date.parse(d.updatedAt) > 120_000)
    if (!last || !prev) continue
    const t1 = textOf(last.version.body)
    const t0 = textOf(prev.version.body)
    const same = t1 === t0 && last.version.title === prev.version.title && last.version.dek === prev.version.dek
    let at = 0
    while (at < Math.min(t0.length, t1.length) && t0[at] === t1[at]) at++
    console.log(`articles-report: ${a.slug}: last save ${String(last.updatedAt).slice(0, 16)} vs ${String(prev.updatedAt).slice(0, 16)}: words ${same ? 'unchanged' : `changed (${t0.length} -> ${t1.length} chars; first difference: "${t0.slice(at, at + 60)}" -> "${t1.slice(at, at + 60)}")`}`)
  }
  const media = await payload.find({ collection: 'media', where: { filename: { like: 'ikon-2026-' } }, limit: 50, depth: 0, overrideAccess: true })
  console.log(`articles-report: ikon media: ${media.docs.length} doc(s), ${media.docs.filter((m) => m.staticUrl).length} with a static url`)
}

// articles-reword: changes a phrase in an article's saved words, for an
// article edited in the admin whose words the import leaves alone (a note
// a writing tool left behind, say). Each entry in data/article-rewords.json
// is { slug, from, to }; "from" must appear whole inside one run of text.
// An entry { media, credit } sets the credit of a photo already on the site
// (named by its stored file name), since the import writes a photo's credit
// only when it first adds the photo. Running it again changes nothing.
type Reword = { slug: string; from: string; to: string } | { media: string; credit: string }
async function rewordArticles(payload: Payload) {
  const file = path.join(process.cwd(), 'data', 'article-rewords.json')
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as Reword[]
  for (const entry of entries) {
    if ('media' in entry) {
      const m = (await payload.find({ collection: 'media', where: { filename: { equals: entry.media } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
      if (!m) console.log(`articles-reword: media ${entry.media}: no such photo`)
      else if ((m.credit ?? '') === entry.credit) console.log(`articles-reword: media ${entry.media}: credit already "${entry.credit}", nothing to change`)
      else {
        await payload.update({ collection: 'media', id: m.id, data: { credit: entry.credit }, overrideAccess: true })
        console.log(`articles-reword: media ${entry.media}: credit "${m.credit ?? ''}" -> "${entry.credit}"`)
      }
      continue
    }
    const { slug, from, to } = entry
    const a = (await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!a) {
      console.log(`articles-reword: ${slug}: no such article`)
      continue
    }
    const draft = await unpublishedDraft(payload, a.id)
    if (draft) {
      console.log(`articles-reword: ${slug}: has a draft saved in the admin ${String(draft.updatedAt).slice(0, 16)} that is not published yet, so it is left alone`)
      continue
    }
    const body = structuredClone(a.body) as unknown as LexDoc
    let hits = 0
    const walk = (n: LexNode) => {
      if (n.type === 'text' && n.text?.includes(from)) {
        n.text = n.text.split(from).join(to)
        hits++
      }
      ;(n.children ?? []).forEach(walk)
    }
    body.root.children.forEach(walk)
    const dek = a.dek?.includes(from) ? a.dek.split(from).join(to) : a.dek
    if (dek !== a.dek) hits++
    if (!hits) {
      console.log(`articles-reword: ${slug}: "${from.slice(0, 60)}" not found, nothing to change`)
      continue
    }
    await payload.update({ collection: 'articles', id: a.id, data: { body, dek, _status: 'published' } as never, overrideAccess: true })
    console.log(`articles-reword: ${slug}: changed ${hits} place(s): "${from.slice(0, 60)}" -> "${to.slice(0, 60)}"`)
  }
}

// Read-only: what was changed in the admin since the last import, block by
// block. The last import is the saved version whose words match its
// fingerprint; the blocks only it has were removed or rewritten, the blocks
// only the current version has were added or are the rewrites.
async function diffArticles(payload: Payload) {
  const blocks = (body: unknown) => ((body as { root?: { children?: unknown[] } } | null)?.root?.children ?? []).map((n) => lexicalText(n)).filter(Boolean)
  const cut = (t: string) => (t.length > 200 ? `${t.slice(0, 200)}...` : t)
  const all = await payload.find({ collection: 'articles', limit: 100, depth: 0, draft: true, overrideAccess: true, sort: 'slug' })
  for (const a of all.docs) {
    const v = await payload.findVersions({ collection: 'articles', where: { parent: { equals: a.id } }, sort: 'updatedAt', limit: 100, depth: 0, overrideAccess: true })
    const docs = v.docs as { updatedAt: string; version: { title?: string; dek?: string | null; body?: unknown; _status?: string } }[]
    const hashOf = (d: (typeof docs)[number]) => articleWordsHash(d.version.title, d.version.dek, d.version.body)
    const lastWords = wordsPart(a.importedHash)
    let imported = lastWords ? docs.filter((d) => hashOf(d) === lastWords).pop() : undefined
    console.log(`articles-diff: ${a.slug}: versions ${docs.map((d) => `${d.updatedAt.slice(5, 16)}${d.version._status === 'draft' ? ' draft' : ''}${lastWords && hashOf(d) === lastWords ? ' (import)' : ''}`).join(', ')}`)
    if (!imported) {
      // edited before fingerprints existed: compare with the markdown file
      const file = path.join(articlesDir(), `${a.slug}.md`)
      const m = fs.existsSync(file) ? /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(fs.readFileSync(file, 'utf8')) : null
      if (!m) {
        console.log(`articles-diff: ${a.slug}: no saved version matches the last import, and there is no markdown file to compare with`)
        continue
      }
      const meta = Object.fromEntries(m[1].split('\n').map((l) => /^(\w+):\s*(.*)$/.exec(l)).filter((kv): kv is RegExpExecArray => Boolean(kv)).map((kv) => [kv[1], kv[2].trim()]))
      console.log(`articles-diff: ${a.slug}: no saved version matches the last import${lastWords ? '' : ' (no fingerprint)'}; comparing with ${a.slug}.md instead`)
      imported = { updatedAt: '', version: { title: meta.title, dek: meta.dek || null, body: htmlToLexical(markdownToHtml(m[2])).value } }
    }
    if (articleWordsHash(a.title, a.dek, a.body) === lastWords) {
      console.log(`articles-diff: ${a.slug}: words as imported`)
      continue
    }
    if (imported.version.title !== a.title) console.log(`articles-diff: ${a.slug}: title "${imported.version.title}" -> "${a.title}"`)
    if ((imported.version.dek ?? '') !== (a.dek ?? '')) console.log(`articles-diff: ${a.slug}: dek "${cut(imported.version.dek ?? '')}" -> "${cut(a.dek ?? '')}"`)
    const before = blocks(imported.version.body)
    const after = blocks(a.body)
    const left = [...after]
    const removed = before.filter((b) => {
      const i = left.indexOf(b)
      if (i === -1) return true
      left.splice(i, 1)
      return false
    })
    console.log(`articles-diff: ${a.slug}: ${before.length} -> ${after.length} block(s); ${removed.length} only in the import, ${left.length} only now`)
    for (const b of removed.slice(0, 15)) console.log(`articles-diff: ${a.slug}:   - ${cut(b)}`)
    for (const b of left.slice(0, 15)) console.log(`articles-diff: ${a.slug}:   + ${cut(b)}`)
  }
}

// Read-only: the latest uploads and every hotel, review and lounge whose
// photo comes from an upload, to see what an editor has added.
async function reportMedia(payload: Payload) {
  const latest = await payload.find({ collection: 'media', sort: '-createdAt', limit: 15, depth: 0, overrideAccess: true })
  for (const m of latest.docs) console.log(`media-report: media ${m.id} ${m.filename} (${m.mimeType}, ${m.width}x${m.height}) created ${String(m.createdAt).slice(0, 16)}${m.staticUrl ? ` static ${m.staticUrl}` : ''}`)
  for (const slug of ['hotels', 'reviews'] as const) {
    const res = await payload.find({ collection: slug, where: { heroImage: { exists: true } }, limit: 50, depth: 1, draft: true, overrideAccess: true })
    for (const d of res.docs as { id: number; slug?: string; heroImage?: unknown; externalImageUrl?: string | null; updatedAt?: string }[]) {
      const h = d.heroImage && typeof d.heroImage === 'object' ? (d.heroImage as { filename?: string; url?: string }) : null
      // public pages read the published version only; an upload saved as a
      // draft is not on the site until someone presses Publish changes
      const live = (await payload.find({ collection: slug, where: { id: { equals: d.id } }, limit: 1, depth: 0, draft: false, overrideAccess: true })).docs[0] as { _status?: string; heroImage?: unknown } | undefined
      const shown = live?._status === 'published' && live.heroImage != null
      console.log(`media-report: ${slug} ${d.slug}: hero image ${h ? `${h.filename} (${h.url})` : String(d.heroImage)}; webflow photo ${d.externalImageUrl ? 'yes' : 'no'}; updated ${String(d.updatedAt).slice(0, 16)}; ${shown ? 'published with it' : `not published with it (published version: ${live?._status ?? 'none'}, hero image ${live?.heroImage != null ? 'set' : 'not set'})`}`)
    }
    console.log(`media-report: ${slug} with an uploaded hero image: ${res.totalDocs}`)
  }
  const total = await payload.count({ collection: 'hotels', where: { externalImageUrl: { exists: true } }, overrideAccess: true })
  console.log(`media-report: hotels with a webflow photo: ${total.totalDocs}`)
}

// ---- Milestone rewards -----------------------------------------------------------
// The same terms as a list: one entry per milestone, choices one per line.
const MILESTONE_LIST: Record<string, { at: string; rewards: string }[]> = {
  'world-of-hyatt': [
    { at: '20 nights', rewards: '2,000 bonus points\nA Club lounge access award' },
    { at: '30 nights', rewards: 'Two Club lounge access awards\n5,000 bonus points\nA $100 Hyatt gift card\nA FIND experience credit' },
    { at: '40 nights', rewards: 'The same choices as 30 nights\nA 15% points bonus for the rest of the year' },
    { at: '50 nights', rewards: 'A free night at a category 1 to 4 hotel\nThe same choices as 30 nights' },
    { at: '60 nights (Globalist)', rewards: 'A suite upgrade award, up to 7 nights\nA free night at a category 1 to 7 hotel' },
    { at: '70, 80 and 90 nights', rewards: 'A further suite upgrade award at each\nBonus points' },
    { at: '100 nights', rewards: 'A free night at a category 1 to 8 hotel' },
    { at: '150 nights', rewards: 'A free night at a category 1 to 8 hotel\n5,000 bonus points for every 10 nights beyond' },
  ],
  'marriott-bonvoy': [
    { at: '50 nights', rewards: 'An Annual Choice Benefit: five Nightly Upgrade Awards\nOr a free night award worth up to 40,000 points\nOr a $250 charity gift\nOr Gold status for a friend' },
    { at: '75 nights', rewards: 'A second Annual Choice Benefit: a free night worth up to 40,000 points\nOr five more Nightly Upgrade Awards' },
    { at: '100 nights and $23,000 spend', rewards: 'Ambassador Elite\nA personal ambassador\nYour24 check-in at any hour' },
  ],
  'hilton-honors': [
    { at: '40 nights', rewards: '10,000 bonus points, then 10,000 more for every 10 nights' },
    { at: '60 nights', rewards: 'A free night reward\nOr 30,000 bonus points' },
    { at: '100 nights or $30,000 spend', rewards: 'Diamond status to gift to a friend' },
    { at: 'Into next year', rewards: 'Elite nights above the tier threshold roll over' },
  ],
  'ihg-one-rewards': [
    { at: '20 nights', rewards: '5,000 bonus points\nOr a lounge membership\nOr a free-night discount' },
    { at: '30, 40, 50 and 60 nights', rewards: 'A further choice at each: suite upgrades, points or food-and-beverage rewards' },
    { at: '70 nights', rewards: 'Diamond Elite\nChoices continue every ten nights to 100' },
    { at: 'Claiming', rewards: 'Pick each choice in your account within 30 days of the milestone' },
  ],
}
async function seedMilestones(payload: Payload) {
  let set = 0
  for (const [slug, list] of Object.entries(MILESTONE_LIST)) {
    const p = (await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!p || (p.milestoneList?.length ?? 0) > 0) continue
    await payload.update({ collection: 'programs', id: p.id, data: { milestoneList: list }, depth: 0, overrideAccess: true })
    set++
  }
  console.log(`seed-milestones: filled ${set} programs`)
}

// ---- Credit cards that grant a tier --------------------------------------------
// Which card gives each tier outright. Fills the source where blank and
// marks the tier as card-granted; an editor's text is kept.
const CARD_TIERS: Record<string, string> = {
  'hilton-silver': 'Hilton Honors American Express card',
  'hilton-gold': 'Hilton Honors Surpass or Business card, or the Amex Platinum',
  'hilton-diamond': 'Hilton Honors Aspire card',
  'ihg-silver': 'IHG One Rewards Traveler card',
  'ihg-platinum': 'IHG One Rewards Premier or Premier Business card',
  'bonvoy-silver': 'Marriott Bonvoy Bold or Boundless card',
  'bonvoy-gold': 'Marriott Bonvoy Bevy or Bountiful card, or the Amex Platinum',
  'bonvoy-platinum': 'Marriott Bonvoy Brilliant card',
  'hyatt-discoverist': 'World of Hyatt Credit Card or Business card',
}
async function seedCards(payload: Payload) {
  let set = 0
  for (const [slug, source] of Object.entries(CARD_TIERS)) {
    const t = (await payload.find({ collection: 'status-levels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!t) continue
    if (t.creditCard?.grantsStatus && t.creditCard.source) continue
    await payload.update({ collection: 'status-levels', id: t.id, data: { creditCard: { grantsStatus: true, source: t.creditCard?.source || source } }, depth: 0, overrideAccess: true })
    set++
  }
  console.log(`seed-cards: filled ${set} tiers`)
}

// ---- Retire a tier ------------------------------------------------------------
// Lifetime Globalist is not a tier readers pick from: it carries Globalist
// benefits. Anything filed under it moves to Globalist, then it goes.
async function retireTiers(payload: Payload) {
  const find = async (slug: string) => (await payload.find({ collection: 'status-levels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  const gone = await find('hyatt-lifetime-globalist')
  const keep = await find('hyatt-globalist')
  if (!gone) {
    console.log('retire-tiers: nothing to do')
    return
  }
  if (!keep) throw new Error('retire-tiers: Globalist tier missing')
  let moved = 0
  for (const collection of ['reviews', 'reader-stays', 'lounge-ratings'] as const) {
    const res = await payload.find({ collection, where: { statusHeld: { equals: gone.id } }, limit: 5000, depth: 0, overrideAccess: true })
    for (const doc of res.docs) {
      await payload.update({ collection, id: doc.id, data: { statusHeld: keep.id } as never, depth: 0, overrideAccess: true })
      moved++
    }
  }
  const lounges = await payload.find({ collection: 'lounges', where: { 'access.tiers': { equals: gone.id } }, limit: 1000, depth: 0, overrideAccess: true })
  for (const l of lounges.docs) {
    const tiers = (l.access?.tiers ?? []).map((t) => (typeof t === 'object' ? t.id : t)).filter((id) => id !== gone.id)
    if (!tiers.includes(keep.id)) tiers.push(keep.id)
    await payload.update({ collection: 'lounges', id: l.id, data: { access: { ...l.access, tiers } } as never, depth: 0, overrideAccess: true })
    moved++
  }
  await payload.delete({ collection: 'status-levels', id: gone.id, overrideAccess: true })
  console.log(`retire-tiers: moved ${moved} references to Globalist and removed Lifetime Globalist`)
}

// ---- Club lounge flags ---------------------------------------------------------
// data/lounges/<program>.json comes from scripts/lounges/fetch.ts. Applies the
// yes/no to hotels that have no answer yet; an editor's answer is kept.
async function loungeFlags(payload: Payload) {
  const dir = path.resolve(process.cwd(), 'data/lounges')
  if (!fs.existsSync(dir)) {
    console.log('lounge-flags: no data')
    return
  }
  let set = 0
  let kept = 0
  let missing = 0
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, { lounge: boolean }>
    for (const [slug, r] of Object.entries(rows)) {
      const hotel = (await payload.find({ collection: 'hotels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
      if (!hotel) {
        missing++
        continue
      }
      if (hotel.clubLounge) {
        kept++
        continue
      }
      await payload.update({ collection: 'hotels', id: hotel.id, data: { clubLounge: r.lounge ? 'yes' : 'no' }, depth: 0, overrideAccess: true })
      set++
    }
  }
  console.log(`lounge-flags: ${set} set, ${kept} already answered, ${missing} hotels not found`)
}

// ---- Lounge records ------------------------------------------------------------------
// One lounge per hotel flagged as having one, so every lounge has a page to
// rate. The name comes from the chain's own page where the fetch saw it,
// else the brand's usual name. Access is the program's lounge-eligible
// tiers plus club rooms. Hours and services are left for an editor.
const LOUNGE_NAME_WORDS = /Club InterContinental|Regency Club|Grand Club|Sheraton Club|Westin Club|Ritz-Carlton Club|St\. Regis Club|Regent Club|Concierge Lounge|Executive Lounge|Executive Club|Club Lounge|M Club|Club Level|Club Floor/gi
const LOUNGE_NAME_CANON: Record<string, string> = {
  'club intercontinental': 'Club InterContinental',
  'regency club': 'Regency Club',
  'grand club': 'Grand Club',
  'sheraton club': 'Sheraton Club',
  'westin club': 'Westin Club',
  'ritz-carlton club': 'The Ritz-Carlton Club',
  'st. regis club': 'St. Regis Club',
  'regent club': 'Regent Club',
  'concierge lounge': 'Concierge Lounge',
  'executive lounge': 'Executive Lounge',
  'executive club': 'Executive Club',
  'club lounge': 'Club Lounge',
  'm club': 'M Club',
  'club level': 'Club Lounge',
  'club floor': 'Club Lounge',
}
const LOUNGE_BRAND_DEFAULT: Record<string, string> = {
  'grand-hyatt': 'Grand Club',
  'hyatt-regency': 'Regency Club',
  'marriott-hotels': 'M Club',
  sheraton: 'Sheraton Club',
  westin: 'Westin Club',
  'jw-marriott': 'Executive Lounge',
  renaissance: 'Club Lounge',
  'le-meridien': 'Club Lounge',
  'ritz-carlton': 'The Ritz-Carlton Club',
  'st-regis': 'St. Regis Club',
  'delta-hotels': 'Delta Club',
  intercontinental: 'Club InterContinental',
  'crowne-plaza': 'Club Lounge',
  regent: 'Regent Club',
}
const LOUNGE_PROGRAM_DEFAULT: Record<string, string> = {
  'hilton-honors': 'Executive Lounge',
  'marriott-bonvoy': 'Executive Lounge',
  'ihg-one-rewards': 'Club Lounge',
  'world-of-hyatt': 'Club Lounge',
}

async function seedLounges(payload: Payload) {
  // lounge names seen on the chains' pages, by hotel slug
  const seen: Record<string, string> = {}
  const dir = path.resolve(process.cwd(), 'data/lounges')
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const rows = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, { lounge: boolean; hits?: string[] }>
      for (const [slug, r] of Object.entries(rows)) {
        if (!r.lounge) continue
        const counts = new Map<string, number>()
        for (const h of r.hits ?? []) for (const m of h.matchAll(LOUNGE_NAME_WORDS)) {
          const k = LOUNGE_NAME_CANON[m[0].toLowerCase()] ?? m[0]
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
        if (best) seen[slug] = best[0]
      }
    }
  }
  const programs = await payload.find({ collection: 'programs', limit: 20, depth: 0, overrideAccess: true })
  const brands = await payload.find({ collection: 'brands', limit: 500, depth: 0, overrideAccess: true })
  const brandSlug = new Map(brands.docs.map((b) => [b.id, b.slug]))
  const programSlug = new Map(programs.docs.map((p) => [p.id, p.slug]))
  const tiers = await payload.find({ collection: 'status-levels', limit: 100, depth: 0, overrideAccess: true })
  const loungeTiers = new Map<number, number[]>()
  for (const t of tiers.docs) {
    if (!t.eligibility?.lounge) continue
    const pid = typeof t.program === 'object' ? t.program.id : t.program
    loungeTiers.set(pid, [...(loungeTiers.get(pid) ?? []), t.id])
  }
  const existing = await payload.find({ collection: 'lounges', limit: 10000, depth: 0, overrideAccess: true, select: { hotel: true, slug: true } })
  const hasLounge = new Set(existing.docs.map((l) => (typeof l.hotel === 'object' ? l.hotel?.id : l.hotel)))
  const slugs = new Set(existing.docs.map((l) => l.slug))

  const hotels = await payload.find({ collection: 'hotels', where: { clubLounge: { equals: 'yes' } }, limit: 10000, depth: 0, overrideAccess: true })
  let made = 0
  let kept = 0
  for (const h of hotels.docs) {
    if (hasLounge.has(h.id)) {
      kept++
      continue
    }
    const pid = typeof h.program === 'object' ? h.program?.id : h.program
    const bid = typeof h.brand === 'object' ? h.brand?.id : h.brand
    const name = seen[h.slug ?? ''] ?? LOUNGE_BRAND_DEFAULT[brandSlug.get(bid ?? -1) ?? ''] ?? LOUNGE_PROGRAM_DEFAULT[programSlug.get(pid ?? -1) ?? ''] ?? 'Club Lounge'
    let slug = `${h.slug}-${slugify(name)}`
    for (let i = 2; slugs.has(slug); i++) slug = `${h.slug}-${slugify(name)}-${i}`
    slugs.add(slug)
    await payload.create({
      collection: 'lounges',
      overrideAccess: true,
      data: {
        name,
        slug,
        hotel: h.id,
        access: { tiers: pid ? (loungeTiers.get(pid) ?? []) : [], clubRooms: true },
        externalImageUrl: h.externalImageUrl ?? null,
        _status: 'published',
      } as never,
    })
    made++
  }
  console.log(`seed-lounges: created ${made} lounge(s), ${kept} hotel(s) already had one`)
}

// ---- Reported stays from the forum pipeline -------------------------------------------
// Reads loyalist-pipeline/data/data_points.csv (one row per stay the
// extraction found) and upserts each as a sourced report, keyed on source
// and post id so reruns update in place. Low-confidence rows are skipped;
// high- and medium-confidence ones arrive approved (Austin's call 2026-10-18:
// display all medium). An editor's later status change is kept on rerun,
// except records still sitting at the import's old 'pending' holding state
// are promoted to approved.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

// The pipeline's status slugs, where they differ from the site's.
const STATUS_ALIAS: Record<string, string> = { 'hyatt-lifetime-globalist': 'hyatt-globalist' }

async function importSourcedReports(payload: Payload) {
  const file = path.resolve(process.cwd(), 'loyalist-pipeline/data/data_points.csv')
  if (!fs.existsSync(file)) {
    console.log('sourced-reports: no data_points.csv yet')
    return
  }
  const rows = parseCsv(fs.readFileSync(file, 'utf8'))
  const tiers = await payload.find({ collection: 'status-levels', limit: 100, depth: 0, overrideAccess: true })
  const tierBySlug = new Map(tiers.docs.map((t) => [t.slug, t]))
  const hotelCache = new Map<string, { id: number; program: number | null } | null>()
  const hotelFor = async (slug: string) => {
    if (hotelCache.has(slug)) return hotelCache.get(slug) ?? null
    const h = (await payload.find({ collection: 'hotels', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    const v = h ? { id: h.id, program: typeof h.program === 'object' ? (h.program?.id ?? null) : (h.program ?? null) } : null
    hotelCache.set(slug, v)
    return v
  }
  let created = 0
  let updated = 0
  let skipped = 0
  let unmatched = 0
  const or = (v: string, allowed: string[], fallback: string | null) => (allowed.includes(v) ? v : fallback)
  for (const r of rows) {
    if (r.confidence === 'low' || !r.post_id || !r.post_url) {
      skipped++
      continue
    }
    const hotel = await hotelFor(r.hotel_slug)
    if (!hotel) {
      unmatched++
      console.log(`sourced-reports: no hotel with slug ${r.hotel_slug}`)
      continue
    }
    const source = (r.source ?? '').toLowerCase().includes('flyertalk') ? 'flyertalk' : (r.source ?? '').toLowerCase().includes('reddit') ? 'reddit' : 'blog'
    const sourceKey = `${source}:${r.post_id}:${r.hotel_slug}`
    const tierSlug = STATUS_ALIAS[r.status_held] ?? r.status_held
    const tier = tierBySlug.get(tierSlug)
    const data = {
      confidence: r.confidence,
      hotel: hotel.id,
      program: hotel.program,
      statusHeld: tier?.id ?? null,
      source,
      postUrl: r.post_url,
      postDate: /^\d{4}-\d{2}-\d{2}/.test(r.post_date) ? r.post_date.slice(0, 10) : null,
      stayMonth: /^\d{4}-\d{2}$/.test(r.stay_month) ? r.stay_month : null,
      summary: r.summary,
      upgrade: or(r.upgrade, ['none', 'yes', 'award', 'unknown'], 'unknown'),
      upgradeType: or(r.upgrade_type, ['floor', 'view', 'category', 'suite'], null),
      suiteType: or(r.suite_type, ['junior', 'one-bedroom', 'two-bedroom', 'specialty'], null),
      upgradeHow: or(r.upgrade_how, ['proactive', 'asked'], null),
      breakfast: or(r.breakfast, ['full', 'buffet', 'a-la-carte', 'credit', 'not-honoured', 'not-eligible', 'unknown'], 'unknown'),
      loungeAccess: or(r.lounge_access, ['given', 'declined', 'not-used', 'unknown'], 'unknown'),
      lateCheckout: or(r.late_checkout, ['honoured', 'declined', 'not-requested', 'unknown'], 'unknown'),
      welcomeAmenity: or(r.welcome_amenity, ['given', 'not-given', 'unknown'], 'unknown'),
      roomBooked: r.room_booked || null,
      roomReceived: r.room_received || null,
      sentiment: or(r.sentiment, ['positive', 'mixed', 'negative'], 'mixed'),
      sourceKey,
      model: r.model || null,
      extractedAt: r.extracted_at || null,
    }
    const existing = (await payload.find({ collection: 'sourced-reports', where: { sourceKey: { equals: sourceKey } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (existing) {
      const promote = (existing as { status?: string }).status === 'pending' ? { status: 'approved' } : {}
      // a new summary needs a new short one (shorten-summaries writes it)
      const reshorten = existing.summary !== data.summary ? { shortSummary: null } : {}
      await payload.update({ collection: 'sourced-reports', id: existing.id, data: { ...data, ...promote, ...reshorten } as never, overrideAccess: true })
      updated++
    } else {
      await payload.create({ collection: 'sourced-reports', data: { ...data, status: 'approved' } as never, overrideAccess: true })
      created++
    }
  }
  console.log(`sourced-reports: ${created} created, ${updated} updated, ${skipped} skipped (low confidence or incomplete), ${unmatched} with no matching hotel`)
  await recountReportCounts(payload)
}

// ---- Short summaries of reported stays ------------------------------------------
// The extraction's summary of a stay runs to sixty words and reads like a
// report. The hotel page shows each stay's facts (status, upgrade, room,
// breakfast and so on) in a box of their own, so what goes under them is a
// line or two on what stood out: the stay's short summary. The import above
// clears it when a stay's summary changes, and one edited in the admin is
// kept. Two steps fill it, each only for stays without one:
//
//   short-summaries     from data/stay-short-summaries.json, written ahead
//                       and keyed by a hash of the full summary each was
//                       written from, so a changed summary matches nothing;
//                       it lists the stays still without one
//   shorten-summaries   written on the spot (needs ANTHROPIC_API_KEY)
//
// Until a stay has one, the page shows its full summary.

const shortSummaryKey = (summary: string) => createHash('sha256').update(summary.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16)

const withoutShortSummary: Where = { and: [{ status: { not_equals: 'rejected' } }, { or: [{ shortSummary: { exists: false } }, { shortSummary: { equals: '' } }] }] }

async function applyShortSummaries(payload: Payload) {
  const file = path.resolve(process.cwd(), 'data/stay-short-summaries.json')
  const shorts: Record<string, { hotel?: string; short: string }> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  const docs = (await payload.find({ collection: 'sourced-reports', where: withoutShortSummary, sort: '-postDate', depth: 0, pagination: false, overrideAccess: true, select: { summary: true, sourceKey: true } })).docs
  const missing: typeof docs = []
  let written = 0
  for (const d of docs) {
    const short = shorts[shortSummaryKey(d.summary)]?.short?.trim()
    if (!short) {
      missing.push(d)
      continue
    }
    await payload.update({ collection: 'sourced-reports', id: d.id, data: { shortSummary: short }, depth: 0, overrideAccess: true })
    written++
  }
  console.log(`short-summaries: wrote ${written}, ${missing.length} still without one`)
  for (const d of missing) console.log(`  ${shortSummaryKey(d.summary)}  ${d.sourceKey}  ${d.summary}`)
}

const SHORTEN_MODEL = 'claude-opus-5-5'
const SHORTEN_BATCH = 20
const SHORTEN_AT_ONCE = 4
const SHORT_MAX_WORDS = 32

const SHORTEN_SYSTEM = `You rewrite summaries of hotel stays for a travel site. Each item has the stay's facts, which the site shows in a box right above your text, and a longer summary of a forum post about the stay. Write the short version that goes under the facts box.

How to write it:
- One or two short sentences, 25 words at most.
- Plain, everyday English, the way a friend who stayed there would sum it up over coffee. Short words. No semicolons, no em dashes.
- Lead with what stood out: what made the stay good or bad, a problem, a price or a fee, how the upgrade came about, whether they would go back.
- Do not repeat the facts box (status, whether there was an upgrade, the room names, breakfast, lounge, late checkout, the welcome amenity) unless you add something it does not say, such as the breakfast bill being waived or the gift being wine.
- No person as the subject. Never "the poster", "the guest", "the member", "a Globalist", "this traveler". Start with the thing itself: "Upgraded the morning of check-in", "Paid for the suite", "Breakfast was".
- No reporting words such as praised, noted, described, highlighted, reported, called, said, mentioned, criticized.
- No brochure words such as seamless, world-class, stunning, standout, highlight, elevated, exceptional, impeccable.
- Use only what the summary says. Add nothing, guess nothing, and keep every number, price and name exact. If the summary says little beyond the facts, write one short sentence.

Examples:

Facts: Status: Globalist · Upgrade: One-bedroom suite, offered without asking · Room: 2 queen room (cash) → One bedroom villa
Summary: A Globalist on a four-night cash stay for three adults was texted the morning of check-in about an upgrade from a 2-queen room to a one-bedroom villa, with a golf-cart shuttle since the villa sits behind the pools. Check-in was quick with the room ready at 1pm, though Globalist amenities were not explained and late checkout had to be requested separately.
Short: Heard about the villa by text the morning of check-in. Room ready at 1pm, but nobody explained the perks and late checkout took a separate ask.

Facts: Status: Discoverist · Upgrade: Better view, offered without asking · Room: base King → high floor King with City View · Breakfast: Full: buffet and à la carte · Welcome amenity: Given
Summary: A Discoverist couple split a two-night February stay between a $720 Prive cash rate and a 35,000-point award night. The Prive rate brought a complimentary move from a base King to a high-floor north-facing city view King with a bright bathroom, plus an anniversary amenity and breakfast charges wiped, though the front desk charged $50 to keep the same upgraded room on the points night. They praised the warm service and spacious room but found the restaurant breakfast only okay and the second-night upsell irritating.
Short: The $720 Prive night came with the upgrade, but keeping the room for the 35,000-point night cost $50. Warm service, breakfast only okay.

Facts: Status: Globalist · Upgrade: None · Room: 1-bedroom suite (paid)
Summary: A Globalist who paid for a 1-bedroom suite called it an absolute disgrace, describing a tiny closet-like bathroom, unsightly furnishings, trash in the hallways, and unsecured elevators. They said they would never stay at the property again.
Short: A disgrace for a paid suite: a closet-sized bathroom, ugly furniture, trash in the halls and unsecured elevators. Would never stay again.

Facts: Status: Titanium · Upgrade: Better view · Room: standard room → premium oceanview room · Breakfast: Restaurant or F&B credit
Summary: Titanium guest on a recent stay was upgraded to a premium oceanview room but not to a suite; used a breakfast voucher at the on-site Starbucks and described a great stay overall.
Short: Breakfast was a voucher for the hotel's Starbucks. A great stay overall.

Return every item's id with its short version.`

const SHORTEN_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, short: { type: 'string' } },
        required: ['id', 'short'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

type ShortenItem = { id: number; facts: string; summary: string }

// No em dashes on the site; en dashes only in ranges like 2–4pm
const plainShort = (s: string): string | null => {
  const t = s
    .replace(/(\d)\s*–\s*(\d)/g, '$1-$2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  return t && t.split(' ').length <= SHORT_MAX_WORDS ? t : null
}

async function writeShortSummaries(client: Anthropic, items: ShortenItem[]): Promise<Map<number, string>> {
  const res = await client.beta.messages.create({
    model: SHORTEN_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SHORTEN_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SHORTEN_SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  })
  if (res.stop_reason === 'refusal') throw new Error('the request was declined')
  if (res.stop_reason === 'max_tokens') throw new Error('the answer ran out of room')
  const text = res.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('no text in the answer')
  const out = new Map<number, string>()
  for (const { id, short } of (JSON.parse(text.text) as { items: { id: number; short: string }[] }).items) {
    const clean = plainShort(short)
    if (clean) out.set(id, clean)
    else console.log(`shorten-summaries: ${id}: too long, left for the next run: ${short}`)
  }
  return out
}

const errorText = (err: unknown) => (err instanceof Anthropic.APIError ? `${err.status ?? ''} ${err.message}`.trim() : err instanceof Error ? err.message : String(err))
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length

// preview: write nothing, print the before and after of the newest stays
async function shortenSummaries(payload: Payload, preview = 0) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('shorten-summaries: no ANTHROPIC_API_KEY, so the site keeps showing the full summaries')
    return
  }
  const client = new Anthropic({ maxRetries: 4 })
  const tiers = await payload.find({ collection: 'status-levels', limit: 500, depth: 0, overrideAccess: true })
  const tierName = new Map(tiers.docs.map((t) => [t.id, t.shortName ?? t.name]))
  const where: Where = preview ? { status: { equals: 'approved' } } : withoutShortSummary
  const docs = (await payload.find({ collection: 'sourced-reports', where, sort: '-postDate', depth: 0, overrideAccess: true, ...(preview ? { limit: preview } : { pagination: false }) })).docs
  const items: ShortenItem[] = docs.map((d) => {
    const tierId = typeof d.statusHeld === 'object' && d.statusHeld ? d.statusHeld.id : d.statusHeld
    const facts = stayFacts({ ...d, tier: tierId != null ? (tierName.get(tierId) ?? null) : null })
    return { id: d.id, facts: facts.map((f) => `${f.label}: ${f.value}`).join(' · '), summary: d.summary }
  })
  console.log(`shorten-summaries: ${items.length} ${preview ? 'to preview' : 'without a short summary'}`)
  const batches: ShortenItem[][] = []
  for (let i = 0; i < items.length; i += SHORTEN_BATCH) batches.push(items.slice(i, i + SHORTEN_BATCH))
  let written = 0
  let missing = 0
  let failed = 0
  let next = 0
  const work = async () => {
    while (next < batches.length) {
      const batch = batches[next++]
      let shorts: Map<number, string>
      try {
        shorts = await writeShortSummaries(client, batch)
      } catch (err) {
        failed += batch.length
        console.log(`::warning::shorten-summaries: a batch of ${batch.length} failed and is left for the next run: ${errorText(err)}`)
        continue
      }
      for (const it of batch) {
        const short = shorts.get(it.id)
        if (!short) {
          missing++
          continue
        }
        if (preview) {
          console.log(`\n#${it.id}  ${it.facts}\n  before (${wordCount(it.summary)} words): ${it.summary}\n  after  (${wordCount(short)} words): ${short}`)
          continue
        }
        await payload.update({ collection: 'sourced-reports', id: it.id, data: { shortSummary: short }, depth: 0, overrideAccess: true })
        written++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SHORTEN_AT_ONCE, batches.length) }, work))
  console.log(`shorten-summaries: ${preview ? 'previewed' : 'wrote'} ${preview ? items.length - missing - failed : written}, ${missing} left out, ${failed} failed`)
}

// ---- Brand hierarchy ------------------------------------------------------------
// Where each brand sits in its program, top first. Fills blank ranks only;
// an editor's number is kept.
const BRAND_RANK: Record<string, number> = {
  // World of Hyatt
  'park-hyatt': 1, alila: 2, miraval: 3, 'unbound-collection': 4, andaz: 5, 'thompson-hotels': 6, 'grand-hyatt': 7, 'hyatt-zilara': 8, 'hyatt-ziva': 9, 'secrets-resorts': 10, 'dreams-resorts': 11, 'hyatt-regency': 12, 'destination-by-hyatt': 13, 'jdv-by-hyatt': 14, 'hyatt-centric': 15, 'caption-by-hyatt': 16, 'hyatt-brand': 17,
  // Marriott Bonvoy
  'ritz-carlton-reserve': 1, 'ritz-carlton': 2, 'st-regis': 3, bulgari: 4, edition: 5, 'luxury-collection': 6, 'jw-marriott': 7, 'w-hotels': 8, 'design-hotels': 9, 'autograph-collection': 10, 'tribute-portfolio': 11, 'marriott-hotels': 12, westin: 13, sheraton: 14, 'le-meridien': 15, renaissance: 16, 'gaylord-hotels': 17, 'delta-hotels': 18, 'ac-hotels': 19, 'courtyard-by-marriott': 20, aloft: 21, moxy: 22,
  // Hilton Honors
  'waldorf-astoria': 1, lxr: 2, conrad: 3, nomad: 4, 'small-luxury-hotels': 5, signia: 6, canopy: 7, 'curio-collection': 8, 'hilton-hotels-resorts': 9, 'graduate-by-hilton': 10, 'tapestry-collection': 11, doubletree: 12, 'embassy-suites': 13, tempo: 14, motto: 15,
  // IHG One Rewards
  'six-senses': 1, regent: 2, intercontinental: 3, 'vignette-collection': 4, kimpton: 5, hualuxe: 6, 'hotel-indigo': 7, iberostar: 8, 'crowne-plaza': 9, voco: 10, 'even-hotels': 11,
}
async function seedBrandRanks(payload: Payload) {
  let set = 0
  for (const [slug, rank] of Object.entries(BRAND_RANK)) {
    const b = (await payload.find({ collection: 'brands', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!b || b.rank != null) continue
    await payload.update({ collection: 'brands', id: b.id, data: { rank }, depth: 0, overrideAccess: true })
    set++
  }
  console.log(`seed-brand-ranks: filled ${set} brands`)
}

// ---- Club lounge by brand rule (Marriott) ----------------------------------------
// Marriott's site refuses automated reading, so the flag is set by brand and
// region where the answer is nearly always the same. Only blank hotels are
// touched; an editor's answer, or one read from a page, is kept. Brands and
// regions not listed stay blank until a page or a report answers them.
const LOUNGE_RULES: Record<string, { yes?: string[]; no?: true }> = {
  'jw-marriott': { yes: ['asia', 'europe', 'middle-east', 'africa', 'oceania', 'latin-america-caribbean', 'north-america'] },
  'ritz-carlton': { yes: ['asia', 'europe', 'middle-east', 'africa'] },
  'marriott-hotels': { yes: ['asia', 'europe', 'middle-east', 'africa', 'oceania', 'latin-america-caribbean'] },
  sheraton: { yes: ['asia', 'middle-east', 'africa', 'oceania', 'latin-america-caribbean'] },
  westin: { yes: ['asia', 'middle-east', 'africa'] },
  renaissance: { yes: ['asia', 'middle-east', 'africa'] },
  'le-meridien': { yes: ['asia', 'middle-east', 'africa'] },
  'st-regis': { no: true },
  'w-hotels': { no: true },
  edition: { no: true },
  'delta-hotels': { no: true },
  'gaylord-hotels': { no: true },
  'ritz-carlton-reserve': { no: true },
}
async function loungeBrandRules(payload: Payload) {
  const program = (await payload.find({ collection: 'programs', where: { slug: { equals: 'marriott-bonvoy' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!program) throw new Error('marriott-bonvoy program not found')
  const regionSlug = new Map<number, string>()
  for (const r of (await payload.find({ collection: 'regions', limit: 100, depth: 0, overrideAccess: true })).docs) regionSlug.set(r.id, r.slug)
  const destRegion = new Map<number, string | undefined>()
  for (const d of (await payload.find({ collection: 'destinations', limit: 10000, depth: 0, overrideAccess: true, select: { region: true } })).docs) {
    destRegion.set(d.id, typeof d.region === 'number' ? regionSlug.get(d.region) : undefined)
  }
  const hotels = (await payload.find({ collection: 'hotels', where: { and: [{ program: { equals: program.id } }, { clubLounge: { exists: false } }] }, limit: 10000, depth: 1, overrideAccess: true, select: { brand: true, destination: true, slug: true } })).docs
  const counts: Record<string, number> = {}
  let yes = 0
  let no = 0
  for (const h of hotels) {
    const brand = typeof h.brand === 'object' && h.brand ? h.brand.slug : undefined
    const rule = brand ? LOUNGE_RULES[brand] : undefined
    if (!rule) continue
    const destId = typeof h.destination === 'object' && h.destination ? h.destination.id : typeof h.destination === 'number' ? h.destination : undefined
    const region = destId ? destRegion.get(destId) : undefined
    const answer = rule.no ? 'no' : region && rule.yes?.includes(region) ? 'yes' : undefined
    if (!answer) continue
    await payload.update({ collection: 'hotels', id: h.id, data: { clubLounge: answer }, depth: 0, overrideAccess: true })
    counts[`${brand} ${region ?? '-'} ${answer}`] = (counts[`${brand} ${region ?? '-'} ${answer}`] ?? 0) + 1
    if (answer === 'yes') yes++
    else no++
  }
  for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`)
  console.log(`lounge-brand-rules: ${yes} yes, ${no} no, ${hotels.length - yes - no} of ${hotels.length} blank Marriott hotels left blank`)
}

// ---- Hilton -----------------------------------------------------------------
// data/hilton/hotels.json comes from scripts/hilton/fetch.ts. Hilton brand
// codes (the last two letters of each hotel code) map to our brand slugs;
// anything not listed (Hampton, Garden Inn, Tru...) is skipped.

const HILTON_BRANDS: Record<string, string> = {
  WA: 'waldorf-astoria',
  CH: 'conrad',
  OL: 'lxr',
  SA: 'signia',
  NM: 'nomad',
  SL: 'small-luxury-hotels',
  HI: 'hilton-hotels-resorts',
  HH: 'hilton-hotels-resorts',
  HF: 'hilton-hotels-resorts',
  TW: 'hilton-hotels-resorts',
  HN: 'hilton-hotels-resorts',
  CI: 'conrad',
  ND: 'nomad',
  PY: 'canopy',
  QQ: 'curio-collection',
  UP: 'tapestry-collection',
  DT: 'doubletree',
  DI: 'doubletree',
  ES: 'embassy-suites',
  GU: 'graduate-by-hilton',
  PO: 'tempo',
  UA: 'motto',
}

const COUNTRY_ALIASES: Record<string, string> = {
  USA: 'United States', US: 'United States', 'United States of America': 'United States',
  UK: 'United Kingdom', GB: 'United Kingdom', 'Great Britain': 'United Kingdom', England: 'United Kingdom', Scotland: 'United Kingdom', Wales: 'United Kingdom', 'Northern Ireland': 'United Kingdom',
  UAE: 'United Arab Emirates', 'Hong Kong SAR China': 'Hong Kong', 'Hong Kong SAR': 'Hong Kong', 'Macao SAR China': 'Macau', Macao: 'Macau',
  Türkiye: 'Turkey', Czechia: 'Czech Republic', 'Korea, Republic of': 'South Korea', Korea: 'South Korea', 'Viet Nam': 'Vietnam',
  'Russian Federation': 'Russia', 'Taiwan, Province of China': 'Taiwan', Curaçao: 'Curacao', 'Virgin Islands, U.S.': 'U.S. Virgin Islands', 'US Virgin Islands': 'U.S. Virgin Islands',
  "Cote d'Ivoire": 'Ivory Coast', 'Côte d’Ivoire': 'Ivory Coast', 'Trinidad & Tobago': 'Trinidad and Tobago', 'St. Kitts & Nevis': 'Saint Kitts and Nevis', 'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
}

function countryName(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (COUNTRY_ALIASES[t]) return COUNTRY_ALIASES[t]
  if (/^[A-Z]{2}$/.test(t)) {
    const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(t) ?? t
    return COUNTRY_ALIASES[n] ?? n
  }
  return t
}

type HiltonRecord = { ctyhocn: string; brandCode: string | null; url: string; name: string | null; streetAddress: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null; phone: string | null; rooms: number | null; lounge?: boolean; source?: 'page' | 'slug' }

async function importHilton(payload: Payload) {
  const file = path.resolve(process.cwd(), 'data/hilton/hotels.json')
  if (!fs.existsSync(file)) throw new Error('data/hilton/hotels.json is missing; run fetch:hilton first')
  const records = JSON.parse(fs.readFileSync(file, 'utf8')) as HiltonRecord[]
  const program = (await payload.find({ collection: 'programs', where: { slug: { equals: 'hilton-honors' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!program) throw new Error('Hilton Honors program missing')
  const brands = new Map((await payload.find({ collection: 'brands', limit: 500, depth: 0, overrideAccess: true })).docs.map((b) => [b.slug, b.id]))

  // destinations by "city|country", and each country's usual region
  const dests = (await payload.find({ collection: 'destinations', limit: 5000, depth: 0, overrideAccess: true })).docs
  const destByKey = new Map<string, number>()
  const regionByCountry = new Map<string, Map<number, number>>()
  const destSlugs = new Set<string>()
  for (const d of dests) {
    destSlugs.add(d.slug)
    if (d.city && d.country) destByKey.set(`${d.city.toLowerCase()}|${d.country.toLowerCase()}`, d.id)
    if (d.name && d.country) destByKey.set(`${d.name.toLowerCase()}|${d.country.toLowerCase()}`, d.id)
    const region = typeof d.region === 'object' ? d.region?.id : d.region
    if (d.country && region) {
      const m = regionByCountry.get(d.country) ?? new Map<number, number>()
      m.set(region, (m.get(region) ?? 0) + 1)
      regionByCountry.set(d.country, m)
    }
  }
  const usualRegion = (country: string) => {
    const m = regionByCountry.get(country)
    return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null
  }

  // existing hotels in the program, by hotel code in the booking link and by name
  const existing = (await payload.find({ collection: 'hotels', where: { program: { equals: program.id } }, limit: 10000, depth: 0, overrideAccess: true })).docs
  const byCode = new Map<string, (typeof existing)[number]>()
  const byName = new Map<string, (typeof existing)[number]>()
  for (const h of existing) {
    const m = h.bookingLink?.match(/hilton\.com\/en\/hotels\/([a-z0-9]{7})-/i)
    if (m) byCode.set(m[1].toUpperCase(), h)
    byName.set(h.name.toLowerCase(), h)
  }
  const allSlugs = new Set((await payload.find({ collection: 'hotels', limit: 20000, depth: 0, overrideAccess: true, select: { slug: true } })).docs.map((h) => h.slug))

  let created = 0
  let updated = 0
  let skipped = 0
  let newDests = 0
  const skippedBrands: Record<string, number> = {}
  for (const r of records) {
    const brandSlug = r.brandCode ? HILTON_BRANDS[r.brandCode] : null
    const brandId = brandSlug ? brands.get(brandSlug) : null
    if (!brandId) {
      skippedBrands[r.brandCode ?? '??'] = (skippedBrands[r.brandCode ?? '??'] ?? 0) + 1
      skipped++
      continue
    }
    if (!r.name || !r.city || !r.country) {
      skipped++
      continue
    }
    const country = countryName(r.country)!
    const region = country === 'United States' && r.region && US_STATES[r.region.toUpperCase()] ? US_STATES[r.region.toUpperCase()] : r.region
    const key = `${r.city.toLowerCase()}|${country.toLowerCase()}`
    let destId = destByKey.get(key)
    if (!destId) {
      let slug = slugify(r.city)!
      if (destSlugs.has(slug)) slug = slugify(`${r.city} ${country}`)!
      if (destSlugs.has(slug)) slug = slugify(`${r.city} ${region ?? ''} ${country}`)!
      const d = await payload.create({
        collection: 'destinations',
        overrideAccess: true,
        data: { name: r.city, slug, city: r.city, stateOrRegion: region, country, locationLabel: country === 'United States' && region ? `${r.city}, ${region}` : `${r.city}, ${country}`, region: usualRegion(country), _status: 'published' } as never,
      })
      destId = d.id
      destByKey.set(key, destId)
      destSlugs.add(slug)
      newDests++
    }

    const data = {
      brand: brandId,
      program: program.id,
      destination: destId,
      streetAddress: [r.streetAddress, r.city, region && country === 'United States' ? `${r.region} ${r.postalCode ?? ''}`.trim() : [r.postalCode, country].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      phone: r.phone,
      bookingLink: r.url,
      numberOfRooms: r.rooms,
      clubLounge: r.lounge === undefined ? null : r.lounge ? 'yes' : 'no',
    }
    const found = byCode.get(r.ctyhocn) ?? byName.get(r.name.toLowerCase())
    if (found) {
      const patch: Record<string, unknown> = {}
      if (found.enrichmentStatus === 'queued' && r.source === 'page') {
        // created earlier from the address alone; the page's facts replace it
        Object.assign(patch, data, { name: r.name, enrichmentStatus: 'enriched' })
      } else {
        // fill blanks only; never overwrite what the editor already has
        for (const [k, v] of Object.entries(data)) if (v != null && (found as unknown as Record<string, unknown>)[k] == null) patch[k] = v
        if (!found.bookingLink) patch.bookingLink = r.url
      }
      if (Object.keys(patch).length) {
        await payload.update({ collection: 'hotels', id: found.id, data: patch as never, depth: 0, overrideAccess: true })
        updated++
      }
      continue
    }
    let slug = slugify(r.name)!
    if (allSlugs.has(slug)) slug = slugify(`${r.name} ${r.city}`)!
    if (allSlugs.has(slug)) slug = `${slug}-${r.ctyhocn.toLowerCase()}`
    const doc = await payload.create({
      collection: 'hotels',
      overrideAccess: true,
      depth: 0,
      data: { name: r.name, slug, reviewStatus: 'not-reviewed', pointsEligible: true, enrichmentStatus: r.source === 'slug' ? 'queued' : 'enriched', ...data, _status: 'published' } as never,
    })
    allSlugs.add(slug)
    byCode.set(r.ctyhocn, doc)
    byName.set(r.name.toLowerCase(), doc)
    created++
    if ((created + updated) % 250 === 0) console.log(`hilton: ${created} created, ${updated} updated`)
  }
  console.log(`hilton: ${created} created, ${updated} updated, ${skipped} skipped, ${newDests} new destinations`)
  console.log('skipped brand codes:', Object.entries(skippedBrands).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none')
}

// ---- main -------------------------------------------------------------------

const STEPS: Record<string, (p: Payload) => Promise<void>> = {
  regions: importRegions,
  programs: importPrograms,
  'status-levels': importStatusLevels,
  brands: importBrands,
  amenities: importAmenities,
  destinations: importDestinations,
  'rubric-versions': importRubricVersions,
  hotels: importHotels,
  reviews: importReviews,
  publish: publishAll,
  'publish-fast': publishAllFast,
  logos: importLogos,
  'seed-stays': seedStays,
  'unseed-stays': unseedStays,
  images: applyImages,
  'logos-local': fetchLogos,
  hilton: importHilton,
  'seed-articles': seedArticles,
  'unseed-articles': unseedArticles,
  articles: importArticles,
  'articles-refresh': refreshArticleImages,
  'articles-report': reportArticles,
  'articles-diff': diffArticles,
  'articles-reword': rewordArticles,
  'media-report': reportMedia,
  'articles-force': forceImportArticles,
  'retire-tiers': retireTiers,
  'seed-milestones': seedMilestones,
  'seed-cards': seedCards,
  'seed-brand-ranks': seedBrandRanks,
  'lounge-flags': loungeFlags,
  'seed-lounges': seedLounges,
  'sourced-reports': importSourcedReports,
  'short-summaries': applyShortSummaries,
  'shorten-summaries': (p) => shortenSummaries(p),
  'shorten-summaries-preview': (p) => shortenSummaries(p, 12),
  'lounge-brand-rules': loungeBrandRules,
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const steps = only.length ? only : Object.keys(STEPS)
  for (const s of steps) if (!STEPS[s]) throw new Error(`Unknown step ${s}. Steps: ${Object.keys(STEPS).join(', ')}`)

  const { default: config } = await import('../../src/payload.config')
  const payload = await getPayload({ config })
  // Preload every id map so a partial run can resolve references to
  // collections imported earlier.
  for (const c of ['regions', 'programs', 'status-levels', 'brands', 'amenities', 'destinations', 'hotels', 'reviews'] as CollectionSlug[]) {
    await loadIdMap(payload, c)
  }
  for (const s of steps) await STEPS[s](payload)

  if (droppedImages.length) {
    console.log(`\nDropped ${droppedImages.length} inline image(s) from rich text (no media record):`)
    for (const u of droppedImages) console.log('  ' + u)
  }

  console.log('\nCounts:')
  for (const c of ['regions', 'programs', 'status-levels', 'brands', 'amenities', 'destinations', 'rubric-versions', 'hotels', 'reviews'] as CollectionSlug[]) {
    const r = await payload.count({ collection: c, overrideAccess: true })
    console.log(`  ${c.padEnd(18)} ${r.totalDocs}`)
  }
  process.exit(0)
}

// Only as the entry point: the converter above is also imported by tests.
// Both sides are real paths, so a symlinked invocation still counts.
if (process.argv[1] && realPath(path.resolve(process.argv[1])) === realPath(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
