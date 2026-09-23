// Imports the Webflow export in data/webflow into Payload.
//
//   npm run import:webflow            # everything
//   npm run import:webflow -- hotels  # one collection (dependencies must already be in)
//
// Idempotent: every record carries its Webflow id and is updated in place on a
// re-run. Order matters because references resolve by Webflow id:
// regions, programs, status levels, brands, amenities, destinations, rubric
// versions, hotels, reviews.

import fs from 'fs'
import path from 'path'

import type { CollectionSlug, Payload } from 'payload'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
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
}

async function unseedStays(payload: Payload) {
  const res = await payload.delete({ collection: 'reader-stays', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  const r = await payload.delete({ collection: 'lounge-ratings', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  const l = await payload.delete({ collection: 'lounges', where: { slug: { equals: 'mock-park-club-new-york' } }, overrideAccess: true })
  console.log(`unseed-stays: removed ${res.docs.length} mock stays, ${r.docs.length} lounge ratings and ${l.docs.length} mock lounge`)
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
  const file = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/images.json'), 'utf8')) as { hotels?: Record<string, string>; programs?: Record<string, string> }
  let n = 0
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

// Six short mock articles, one per category, so the hub and template have
// something to show. Removed by unseed-articles.
const MOCK_ARTICLES: { title: string; slug: string; category: string; dek: string; date: string; paras: string[] }[] = [
  { title: 'What Globalist actually gets you at check-in (mock)', slug: 'mock-globalist-check-in', category: 'elite-benefits', date: '2026-09-10', dek: 'The printed benefits, then what readers report receiving. The gap is the point.', paras: ['World of Hyatt prints a clear list for Globalist: a room upgrade including standard suites, 4pm late checkout, free breakfast or club access, and waived resort fees. The question is how often the front desk delivers.', 'Reader stays say most of it holds. Upgrades come more often than not, and late checkout is nearly automatic. The suite line is where it thins out, and where city hotels and resorts part ways.', 'Read the odds on each hotel page before you book, and add your own stay after.'] },
  { title: 'World of Hyatt in one page (mock)', slug: 'mock-world-of-hyatt-in-one-page', category: 'programs', date: '2026-09-04', dek: 'Tiers, what each unlocks, and the two ways most people reach the top.', paras: ['Four tiers: Discoverist at 10 nights, Explorist at 30, Globalist at 60, and Lifetime Globalist after a million base points. Milestone rewards along the way are the quiet strength of the program.', 'Most readers who hold Globalist got there through a mix of paid stays and the credit card night credits, then kept it with the annual spend.', 'The program pages on this site list every hotel under each brand, with reader odds where enough stays are in.'] },
  { title: 'Are points or cash the better deal at Park Hyatt New York? (mock)', slug: 'mock-points-or-cash-park-hyatt-new-york', category: 'points-awards', date: '2026-08-28', dek: 'A worked example with real rates, and the value threshold where points win.', paras: ['At 45,000 points a night against cash rates that sit near $1,400, the redemption clears two cents per point on most dates. That is well above what the points cost to earn.', 'Suite awards change the maths again. A confirmed suite upgrade on a points stay at this property is one of the strongest uses in the program.', 'The lounge is the tie-breaker for many readers: it is included on both, but only Globalists and club-room guests get in.'] },
  { title: 'Which hotel card is worth the fee this year (mock)', slug: 'mock-which-hotel-card-is-worth-the-fee', category: 'credit-cards', date: '2026-08-20', dek: 'Four cards, one question: does the free night and status cover the annual fee on its own?', paras: ['The honest answer is that a free night certificate you will actually use covers the fee on all four cards. The difference is in what else comes with it.', 'Automatic mid-tier status matters most where it changes the stay: breakfast, late checkout, and a shot at a better room. On the pages here you can see how each tier fares at a given hotel.', 'We hold no card partnerships, so there is no link to click. Pick the card for the program you already stay with.'] },
  { title: 'How we rate a club lounge (mock)', slug: 'mock-how-we-rate-a-club-lounge', category: 'hotels-lounges', date: '2026-08-12', dek: 'Food, drink, space and service, each out of five, plus the only question that matters: was it worth a club room?', paras: ['Readers who used a lounge score four things from one to five and give an overall mark. They also say whether they would book a club room to get in. Those answers become the lounge score once five stays are in.', 'Access is reported separately. A lounge that prints Globalist access but turns Globalists away shows a low access-honoured rate, and that number is on the lounge page.', 'Hours, dress code and what is served are recorded as printed, so you can check whether cocktail hour lines up with your evening.'] },
  { title: 'Five city hotels where the suite upgrade actually happens (mock)', slug: 'mock-five-city-hotels-suite-upgrade', category: 'hotels-lounges', date: '2026-08-02', dek: 'Ranked by reader-reported suite rate, not by our opinion.', paras: ['Every hotel on this site shows how often top-tier guests got a suite, once enough stays are reported. These five lead the city list.', 'The pattern is clear: newer builds with a deep suite inventory upgrade far more often than grand old houses with twelve suites and a waiting list.', 'Check the hotel page for the current figure before you book. The numbers move as more stays come in.'] },
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
      data: { title: a.title, slug: a.slug, category: a.category, publishedDate: a.date, dek: a.dek, body: paragraphs(a.paras), featured: n === 0, _status: 'published' } as never,
    })
    n++
  }
  console.log(`seed-articles: created ${n} mock articles`)
}

async function unseedArticles(payload: Payload) {
  const res = await payload.delete({ collection: 'articles', where: { slug: { like: 'mock-' } }, overrideAccess: true })
  console.log(`unseed-articles: removed ${res.docs.length} mock articles`)
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
  'retire-tiers': retireTiers,
  'seed-milestones': seedMilestones,
  'seed-cards': seedCards,
  'lounge-flags': loungeFlags,
  'lounge-brand-rules': loungeBrandRules,
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const steps = only.length ? only : Object.keys(STEPS)
  for (const s of steps) if (!STEPS[s]) throw new Error(`Unknown step ${s}. Steps: ${Object.keys(STEPS).join(', ')}`)

  const payload = await getPayload({ config })
  // Preload every id map so a partial run can resolve references to
  // collections imported earlier.
  for (const c of ['regions', 'programs', 'status-levels', 'brands', 'amenities', 'destinations', 'hotels', 'reviews'] as CollectionSlug[]) {
    await loadIdMap(payload, c)
  }
  for (const s of steps) await STEPS[s](payload)

  if (droppedImages.length) {
    console.log(`\nDropped ${droppedImages.length} inline image(s) from rich text (media pipeline is a later step):`)
    for (const u of droppedImages) console.log('  ' + u)
  }

  console.log('\nCounts:')
  for (const c of ['regions', 'programs', 'status-levels', 'brands', 'amenities', 'destinations', 'rubric-versions', 'hotels', 'reviews'] as CollectionSlug[]) {
    const r = await payload.count({ collection: c, overrideAccess: true })
    console.log(`  ${c.padEnd(18)} ${r.totalDocs}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
