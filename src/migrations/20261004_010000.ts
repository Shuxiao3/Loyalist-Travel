import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Reader stays: the suite upgrade certificate becomes its own question, and
// the breakfast and late checkout questions go. Stays that answered "used a
// suite upgrade award" become an upgrade to a suite with the certificate.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_reader_stays_suite_award" AS ENUM('no', 'yes');
  ALTER TABLE "reader_stays" ADD COLUMN "suite_award" "enum_reader_stays_suite_award" DEFAULT 'no' NOT NULL;
  UPDATE "reader_stays" SET "suite_award" = 'yes', "upgrade" = 'yes', "upgrade_type" = 'suite' WHERE "upgrade" = 'award';
  ALTER TABLE "reader_stays" DROP COLUMN IF EXISTS "breakfast";
  ALTER TABLE "reader_stays" DROP COLUMN IF EXISTS "ala_carte_cap";
  ALTER TABLE "reader_stays" DROP COLUMN IF EXISTS "late_checkout";
  DROP TYPE IF EXISTS "public"."enum_reader_stays_breakfast";
  DROP TYPE IF EXISTS "public"."enum_reader_stays_ala_carte_cap";
  DROP TYPE IF EXISTS "public"."enum_reader_stays_late_checkout";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_reader_stays_breakfast" AS ENUM('full', 'buffet', 'a-la-carte', 'credit', 'not-honoured', 'not-eligible');
  CREATE TYPE "public"."enum_reader_stays_ala_carte_cap" AS ENUM('uncapped', 'capped');
  CREATE TYPE "public"."enum_reader_stays_late_checkout" AS ENUM('honoured', 'declined', 'not-requested');
  ALTER TABLE "reader_stays" ADD COLUMN "breakfast" "enum_reader_stays_breakfast" DEFAULT 'not-eligible' NOT NULL;
  ALTER TABLE "reader_stays" ADD COLUMN "ala_carte_cap" "enum_reader_stays_ala_carte_cap";
  ALTER TABLE "reader_stays" ADD COLUMN "late_checkout" "enum_reader_stays_late_checkout" DEFAULT 'not-requested' NOT NULL;
  UPDATE "reader_stays" SET "upgrade" = 'award' WHERE "suite_award" = 'yes';
  ALTER TABLE "reader_stays" DROP COLUMN "suite_award";
  DROP TYPE "public"."enum_reader_stays_suite_award";`)
}
