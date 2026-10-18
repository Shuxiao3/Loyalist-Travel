import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Media: static_url, the address of a photo the site serves from its own
// files (public/images/...). Set by the article import; pages show it in
// place of the uploaded copy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" ADD COLUMN "static_url" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" DROP COLUMN "static_url";`)
}
