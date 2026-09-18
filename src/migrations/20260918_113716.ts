import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hotels" ADD COLUMN "views" numeric DEFAULT 0;
  ALTER TABLE "hotels" ADD COLUMN "stay_count" numeric DEFAULT 0;
  ALTER TABLE "_hotels_v" ADD COLUMN "version_views" numeric DEFAULT 0;
  ALTER TABLE "_hotels_v" ADD COLUMN "version_stay_count" numeric DEFAULT 0;
  CREATE INDEX "hotels_views_idx" ON "hotels" USING btree ("views");
  CREATE INDEX "hotels_stay_count_idx" ON "hotels" USING btree ("stay_count");
  CREATE INDEX "_hotels_v_version_version_views_idx" ON "_hotels_v" USING btree ("version_views");
  CREATE INDEX "_hotels_v_version_version_stay_count_idx" ON "_hotels_v" USING btree ("version_stay_count");
   UPDATE "hotels" h SET "stay_count" = sub.n FROM (SELECT hotel_id, count(*)::int AS n FROM "reader_stays" WHERE status = 'approved' GROUP BY hotel_id) sub WHERE sub.hotel_id = h.id;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "hotels_views_idx";
  DROP INDEX "hotels_stay_count_idx";
  DROP INDEX "_hotels_v_version_version_views_idx";
  DROP INDEX "_hotels_v_version_version_stay_count_idx";
  ALTER TABLE "hotels" DROP COLUMN "views";
  ALTER TABLE "hotels" DROP COLUMN "stay_count";
  ALTER TABLE "_hotels_v" DROP COLUMN "version_views";
  ALTER TABLE "_hotels_v" DROP COLUMN "version_stay_count";`)
}
