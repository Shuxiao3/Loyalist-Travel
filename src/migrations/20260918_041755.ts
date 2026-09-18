import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
  UPDATE "articles" SET "category" = 'hotels-lounges' WHERE "category" IN ('lounges', 'hotels');
  DROP TYPE "public"."enum_articles_category";
  CREATE TYPE "public"."enum_articles_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'hotels-lounges');
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE text;
  UPDATE "_articles_v" SET "version_category" = 'hotels-lounges' WHERE "version_category" IN ('lounges', 'hotels');
  DROP TYPE "public"."enum__articles_v_version_category";
  CREATE TYPE "public"."enum__articles_v_version_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'hotels-lounges');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE "public"."enum__articles_v_version_category" USING "version_category"::"public"."enum__articles_v_version_category";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_articles_category";
  UPDATE "articles" SET "category" = 'hotels' WHERE "category" = 'hotels-lounges';
  CREATE TYPE "public"."enum_articles_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'lounges', 'hotels');
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE text;
  DROP TYPE "public"."enum__articles_v_version_category";
  UPDATE "_articles_v" SET "version_category" = 'hotels' WHERE "version_category" = 'hotels-lounges';
  CREATE TYPE "public"."enum__articles_v_version_category" AS ENUM('elite-benefits', 'programs', 'points-awards', 'credit-cards', 'lounges', 'hotels');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_category" SET DATA TYPE "public"."enum__articles_v_version_category" USING "version_category"::"public"."enum__articles_v_version_category";`)
}
