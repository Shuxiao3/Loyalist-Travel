import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Austin asked for the Ikon Pass guide to be the top pinned guide. The Epic
// Pass guide was marked featured in the admin, and as the newer of the two
// it led the homepage and /guides; the article import keeps settings changed
// in the admin, so its file's "featured: false" never applied. This unpins
// that one article (and its latest version, which the admin edits) and
// touches nothing else. The import's fingerprint still holds the file's
// settings, so the next import sees featured as the file's and keeps it off.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "articles" SET "featured" = false WHERE "slug" = 'epic-pass-ski-hotels-points-2026';
  UPDATE "_articles_v" SET "version_featured" = false
    WHERE "latest" = true AND "parent_id" IN (SELECT "id" FROM "articles" WHERE "slug" = 'epic-pass-ski-hotels-points-2026');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "articles" SET "featured" = true WHERE "slug" = 'epic-pass-ski-hotels-points-2026';
  UPDATE "_articles_v" SET "version_featured" = true
    WHERE "latest" = true AND "parent_id" IN (SELECT "id" FROM "articles" WHERE "slug" = 'epic-pass-ski-hotels-points-2026');`)
}
