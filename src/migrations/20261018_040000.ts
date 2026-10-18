import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Articles: imported_hash, a fingerprint of the words the markdown import
// last wrote, so the import can tell an article edited in the admin and
// leave its words alone.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "articles" ADD COLUMN "imported_hash" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_imported_hash" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "articles" DROP COLUMN "imported_hash";
  ALTER TABLE "_articles_v" DROP COLUMN "version_imported_hash";`)
}
