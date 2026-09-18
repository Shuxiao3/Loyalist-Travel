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

const importStatusLevels = (payload: Payload) =>
  run(payload, 'status-levels', read('status-levels'), (item) => {
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
      categories: categories.map((c) => ({ key: c.key, label: c.label, group: c.group, maxCity: c.maxCity, maxResort: c.maxResort })),
    }
    if (existing.docs[0]) {
      await payload.update({ collection: 'rubric-versions', id: existing.docs[0].id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'rubric-versions', data, overrideAccess: true })
    }
    console.log(`rubric-versions: ${slug}`)
  }
  await seed('v15', 'Rubric v15', 'Locked Sep 16 2026. Maxima from the scoring workbook, Luxury Criteria sheet.', RUBRIC_V15)
  await seed('pre-v15', 'Pre-v15 (Webflow)', 'The version the eight Webflow reviews were scored on: v15 with Bed and sleep out of 5 and Tech out of 3. To be re-scored to v15 after launch.', RUBRIC_PRE_V15)
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
  const preV15 = await rubricVersionId(payload, 'pre-v15')
  await run(payload, 'reviews', read('reviews'), async (item) => {
    const f = item.fieldData
    const scores: Record<string, number | null> = {}
    const narrative: Record<string, unknown> = {}
    for (const [wf, key] of Object.entries(SCORE_MAP)) {
      scores[key] = num(f[`${wf}-score`])
      narrative[key] = rich(f[`${wf}-review`])
    }
    const opening = rich(f['opening-thoughts'])
    const verdict = rich(f['final-verdict'])
    const bookItIf = rich(f['recommended-for'])
    const skipItIf = rich(f['not-recommended-for'])
    const words = [opening, verdict, bookItIf, skipItIf, ...Object.values(narrative)].reduce<number>((n, d) => n + lexicalWordCount(d as never), 0)
    const totals = { hard: num(f['hard-product-score']), soft: num(f['soft-product-score']), overall: num(f['total-review-score']) }

    const doc = await upsert(payload, 'reviews', item, {
      title: f.name,
      slug: f.slug,
      hotel: ref('hotels', f.hotel),
      rubricVersion: preV15,
      propertyType: optionLabel('reviews', 'property-type', f['property-type']) === 'Resort' ? 'resort' : 'city',
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

    // The hook recomputes totals from the category scores; flag any drift
    // from what Webflow stored so it can be checked by hand.
    const computed = (doc as { totals?: { hard?: number; soft?: number; overall?: number } }).totals
    if (computed && (computed.hard !== totals.hard || computed.soft !== totals.soft || computed.overall !== totals.overall)) {
      console.warn(`\n  ${f.slug}: Webflow totals ${totals.hard}/${totals.soft}/${totals.overall} vs computed ${computed.hard}/${computed.soft}/${computed.overall}`)
    }
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
  for (const [statusHeld, upgrade, upgradeType, suiteType, upgradeHow, breakfast, alaCarteCap, lateCheckout] of rows) {
    const la = loungeAnswers[i++]
    await payload.create({
      collection: 'reader-stays',
      overrideAccess: true,
      data: {
        status: 'approved', hotel: hotel.id, program: programId, statusHeld, stayYear: 2026, upgrade, upgradeType, suiteType, upgradeHow, breakfast, alaCarteCap, lateCheckout, submitterHash: MOCK_HASH,
        lounge: la ? { lounge: lounge.id, access: la[0], food: la[1], drink: la[2], space: la[3], service: la[4], overall: la[5], worthIt: la[6], comment: la[7] } : undefined,
      } as never,
    })
  }
  console.log(`seed-stays: ${rows.length} approved mock stays on ${hotel.name}, with a mock lounge`)
}

async function unseedStays(payload: Payload) {
  const res = await payload.delete({ collection: 'reader-stays', where: { submitterHash: { equals: MOCK_HASH } }, overrideAccess: true })
  const l = await payload.delete({ collection: 'lounges', where: { slug: { equals: 'mock-park-club-new-york' } }, overrideAccess: true })
  console.log(`unseed-stays: removed ${res.docs.length} mock stays and ${l.docs.length} mock lounge`)
}

// Photographs from data/images.json, by hotel slug, onto externalImageUrl.
async function applyImages(payload: Payload) {
  const file = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/images.json'), 'utf8')) as { hotels?: Record<string, string> }
  let n = 0
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
  console.log(`images: set ${n} hotel photograph(s)`)
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
