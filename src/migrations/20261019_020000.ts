import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Reported stays: short_summary, the one or two plain sentences the site
// shows, rewritten from the extraction's longer summary by the
// shorten-summaries import step. The longer summary stays as it was.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "sourced_reports" ADD COLUMN "short_summary" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "sourced_reports" DROP COLUMN "short_summary";`)
}
