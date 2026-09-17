import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hotels" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "_hotels_v" ADD COLUMN "version_featured" boolean DEFAULT false;
  CREATE INDEX "hotels_featured_idx" ON "hotels" USING btree ("featured");
  CREATE INDEX "_hotels_v_version_version_featured_idx" ON "_hotels_v" USING btree ("version_featured");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "hotels_featured_idx";
  DROP INDEX "_hotels_v_version_version_featured_idx";
  ALTER TABLE "hotels" DROP COLUMN "featured";
  ALTER TABLE "_hotels_v" DROP COLUMN "version_featured";`)
}
