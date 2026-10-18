import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Hotels: report_count, the approved reader stays plus the approved reported
// stays (forum posts), so the hotels index can sort by how much has been
// reported. Kept in step by the hooks on both collections from here on;
// backfilled once from what is already in. Only approved rows count, as on
// the hotel page.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "hotels" ADD COLUMN "report_count" numeric DEFAULT 0;
  ALTER TABLE "_hotels_v" ADD COLUMN "version_report_count" numeric DEFAULT 0;
  CREATE INDEX "hotels_report_count_idx" ON "hotels" USING btree ("report_count");
  CREATE INDEX "_hotels_v_version_version_report_count_idx" ON "_hotels_v" USING btree ("version_report_count");
  UPDATE "hotels" h SET "report_count" = sub.n FROM (
    SELECT "hotel_id", count(*)::int AS n FROM (
      SELECT "hotel_id" FROM "reader_stays" WHERE "status" = 'approved'
      UNION ALL
      SELECT "hotel_id" FROM "sourced_reports" WHERE "status" = 'approved'
    ) x WHERE "hotel_id" IS NOT NULL GROUP BY "hotel_id"
  ) sub WHERE sub."hotel_id" = h."id";
  UPDATE "_hotels_v" v SET "version_report_count" = h."report_count" FROM "hotels" h WHERE v."parent_id" = h."id" AND v."latest" = true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX "hotels_report_count_idx";
  DROP INDEX "_hotels_v_version_version_report_count_idx";
  ALTER TABLE "hotels" DROP COLUMN "report_count";
  ALTER TABLE "_hotels_v" DROP COLUMN "version_report_count";`)
}
