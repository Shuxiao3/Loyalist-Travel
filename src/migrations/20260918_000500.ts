import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Lounge ratings move from one 1-10 score to five 1-5 scores (food, drink,
// space, service, overall) plus a comment. Existing 1-10 ratings become the
// overall score, halved and rounded up.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_food" numeric;
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_drink" numeric;
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_space" numeric;
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_service" numeric;
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_overall" numeric;
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_comment" varchar;
   UPDATE "reader_stays" SET "lounge_overall" = GREATEST(1, CEIL("lounge_rating" / 2.0)) WHERE "lounge_rating" IS NOT NULL;
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_rating";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" ADD COLUMN "lounge_rating" numeric;
   UPDATE "reader_stays" SET "lounge_rating" = "lounge_overall" * 2 WHERE "lounge_overall" IS NOT NULL;
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_food";
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_drink";
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_space";
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_service";
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_overall";
   ALTER TABLE "reader_stays" DROP COLUMN "lounge_comment";`)
}
