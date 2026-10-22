import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Hilton Honors lowered its Gold and Diamond requirements from January 1,
// 2026: Gold is 25 nights, 15 stays or $6,000 qualifying spend (was 40
// nights; the site said 20), Diamond is 50 nights, 25 stays or $11,500
// (was 60). data/webflow/status-levels.json carries the same correction, so
// a later status-levels import keeps it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "status_levels" SET "nights" = '25 nights, 15 stays or $6,000 spend',
    "short_description" = '25 nights, 15 stays or $6,000 spend; daily breakfast or credit, space-available upgrades.'
    WHERE "slug" = 'hilton-gold';
  UPDATE "status_levels" SET "nights" = '50 nights, 25 stays or $11,500 spend',
    "short_description" = '50 nights, 25 stays or $11,500 spend; breakfast, lounge, space-available upgrades incl. some suites.'
    WHERE "slug" = 'hilton-diamond';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "status_levels" SET "nights" = '20 nights',
    "short_description" = '20+ nights; daily breakfast/credit, space-available upgrades.'
    WHERE "slug" = 'hilton-gold';
  UPDATE "status_levels" SET "nights" = '60 nights',
    "short_description" = '60+ nights; breakfast, lounge, space-available upgrades incl. some suites.'
    WHERE "slug" = 'hilton-diamond';`)
}
