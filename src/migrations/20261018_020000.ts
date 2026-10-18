import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Articles: the categories become News, Guides, Hotels, Airlines and Credit
// Cards. Rows already in move over: elite-benefits, programs and points-awards
// become guides, hotels-lounges becomes hotels, credit-cards stays as it is.
// The two enums are recreated the way 20260918_041755 did it: cast the column
// to text, remap, drop and recreate the type, cast back. Postgres rebuilds
// articles_category_idx and _articles_v_version_version_category_idx with the
// column, so the indexes survive the change.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
  UPDATE "articles" SET "category" = 'guides' WHERE "category" IN ('elite-benefits', 'programs', 'points-awards');
  UPDATE "articles" SET "category" = 'hotels' WHERE "category" = 'hotels-lounges';
  DROP TYPE "public"."enum_articles_category";
  CREATE TYPE "public"."enum_articles_category" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE text;
  UPDATE "_articles_v" SET "version_category" = 'guides' WHERE "version_category" IN ('elite-benefits', 'programs', 'points-awards');
  UPDATE "_articles_v" SET "version_category" = 'hotels' WHERE "version_category" = 'hotels-lounges';
  DROP TYPE "public"."enum__articles_v_version_category";
  CREATE TYPE "public"."enum__articles_v_version_category" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE "public"."enum__articles_v_version_category" USING "version_category"::"public"."enum__articles_v_version_category";`)
}

// Restores the old enum. guides goes back to points-awards and hotels to
// hotels-lounges. news and airlines had no old equivalent, so they too become
// points-awards rather than fail the cast; credit-cards is unchanged.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
  UPDATE "articles" SET "category" = 'points-awards' WHERE "category" IN ('guides', 'news', 'airlines');
  UPDATE "articles" SET "category" = 'hotels-lounges' WHERE "category" = 'hotels';
  DROP TYPE "public"."enum_articles_category";
  CREATE TYPE "public"."enum_articles_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'hotels-lounges');
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE text;
  UPDATE "_articles_v" SET "version_category" = 'points-awards' WHERE "version_category" IN ('guides', 'news', 'airlines');
  UPDATE "_articles_v" SET "version_category" = 'hotels-lounges' WHERE "version_category" = 'hotels';
  DROP TYPE "public"."enum__articles_v_version_category";
  CREATE TYPE "public"."enum__articles_v_version_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'hotels-lounges');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE "public"."enum__articles_v_version_category" USING "version_category"::"public"."enum__articles_v_version_category";`)
}
