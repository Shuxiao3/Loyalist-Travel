import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_reader_stays_upgrade_type" AS ENUM('floor', 'view', 'category', 'suite');
  CREATE TYPE "public"."enum_reader_stays_suite_type" AS ENUM('junior', 'one-bedroom', 'two-bedroom', 'specialty');
  CREATE TYPE "public"."enum_reader_stays_upgrade_how" AS ENUM('proactive', 'asked');
  CREATE TYPE "public"."enum_reader_stays_ala_carte_cap" AS ENUM('uncapped', 'capped');
  ALTER TABLE "reader_stays" ADD COLUMN "upgrade_type" "enum_reader_stays_upgrade_type";
  ALTER TABLE "reader_stays" ADD COLUMN "suite_type" "enum_reader_stays_suite_type";
  ALTER TABLE "reader_stays" ADD COLUMN "upgrade_how" "enum_reader_stays_upgrade_how";
  ALTER TABLE "reader_stays" ADD COLUMN "ala_carte_cap" "enum_reader_stays_ala_carte_cap";

  -- upgrade: the old single answer becomes an answer plus a type
  ALTER TABLE "reader_stays" ALTER COLUMN "upgrade" SET DATA TYPE text;
  UPDATE "reader_stays" SET "upgrade_type" = 'category' WHERE "upgrade" = 'room-category';
  UPDATE "reader_stays" SET "upgrade_type" = 'suite' WHERE "upgrade" = 'suite';
  UPDATE "reader_stays" SET "upgrade" = CASE "upgrade"
    WHEN 'room-category' THEN 'yes'
    WHEN 'suite' THEN 'yes'
    WHEN 'used-award' THEN 'award'
    ELSE "upgrade" END;
  DROP TYPE "public"."enum_reader_stays_upgrade";
  CREATE TYPE "public"."enum_reader_stays_upgrade" AS ENUM('none', 'yes', 'award');
  ALTER TABLE "reader_stays" ALTER COLUMN "upgrade" SET DATA TYPE "public"."enum_reader_stays_upgrade" USING "upgrade"::"public"."enum_reader_stays_upgrade";

  -- breakfast: capped becomes a la carte plus a cap; the rest rename
  ALTER TABLE "reader_stays" ALTER COLUMN "breakfast" SET DATA TYPE text;
  UPDATE "reader_stays" SET "ala_carte_cap" = 'capped' WHERE "breakfast" = 'capped';
  UPDATE "reader_stays" SET "ala_carte_cap" = 'uncapped' WHERE "breakfast" = 'full';
  UPDATE "reader_stays" SET "breakfast" = CASE "breakfast"
    WHEN 'capped' THEN 'a-la-carte'
    WHEN 'restaurant-credit' THEN 'credit'
    WHEN 'none' THEN 'not-honoured'
    ELSE "breakfast" END;
  DROP TYPE "public"."enum_reader_stays_breakfast";
  CREATE TYPE "public"."enum_reader_stays_breakfast" AS ENUM('full', 'buffet', 'a-la-carte', 'credit', 'not-honoured', 'not-eligible');
  ALTER TABLE "reader_stays" ALTER COLUMN "breakfast" SET DATA TYPE "public"."enum_reader_stays_breakfast" USING "breakfast"::"public"."enum_reader_stays_breakfast";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" ALTER COLUMN "upgrade" SET DATA TYPE text;
  DROP TYPE "public"."enum_reader_stays_upgrade";
  CREATE TYPE "public"."enum_reader_stays_upgrade" AS ENUM('none', 'room-category', 'suite', 'used-award');
  ALTER TABLE "reader_stays" ALTER COLUMN "upgrade" SET DATA TYPE "public"."enum_reader_stays_upgrade" USING "upgrade"::"public"."enum_reader_stays_upgrade";
  ALTER TABLE "reader_stays" ALTER COLUMN "breakfast" SET DATA TYPE text;
  DROP TYPE "public"."enum_reader_stays_breakfast";
  CREATE TYPE "public"."enum_reader_stays_breakfast" AS ENUM('full', 'capped', 'restaurant-credit', 'none', 'not-eligible');
  ALTER TABLE "reader_stays" ALTER COLUMN "breakfast" SET DATA TYPE "public"."enum_reader_stays_breakfast" USING "breakfast"::"public"."enum_reader_stays_breakfast";
  ALTER TABLE "reader_stays" DROP COLUMN "upgrade_type";
  ALTER TABLE "reader_stays" DROP COLUMN "suite_type";
  ALTER TABLE "reader_stays" DROP COLUMN "upgrade_how";
  ALTER TABLE "reader_stays" DROP COLUMN "ala_carte_cap";
  DROP TYPE "public"."enum_reader_stays_upgrade_type";
  DROP TYPE "public"."enum_reader_stays_suite_type";
  DROP TYPE "public"."enum_reader_stays_upgrade_how";
  DROP TYPE "public"."enum_reader_stays_ala_carte_cap";`)
}
