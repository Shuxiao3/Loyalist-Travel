import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hotels record whether they have an executive or club lounge.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hotels_club_lounge" AS ENUM('yes', 'no');
  CREATE TYPE "public"."enum__hotels_v_version_club_lounge" AS ENUM('yes', 'no');
  ALTER TABLE "hotels" ADD COLUMN "club_lounge" "enum_hotels_club_lounge";
  ALTER TABLE "_hotels_v" ADD COLUMN "version_club_lounge" "enum__hotels_v_version_club_lounge";
  CREATE INDEX "hotels_club_lounge_idx" ON "hotels" USING btree ("club_lounge");
  CREATE INDEX "_hotels_v_version_version_club_lounge_idx" ON "_hotels_v" USING btree ("version_club_lounge");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "hotels_club_lounge_idx";
  DROP INDEX "_hotels_v_version_version_club_lounge_idx";
  ALTER TABLE "hotels" DROP COLUMN "club_lounge";
  ALTER TABLE "_hotels_v" DROP COLUMN "version_club_lounge";
  DROP TYPE "public"."enum_hotels_club_lounge";
  DROP TYPE "public"."enum__hotels_v_version_club_lounge";`)
}
