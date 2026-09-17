import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" ALTER COLUMN "late_checkout" SET DATA TYPE text;
  UPDATE "reader_stays" SET "late_checkout" = CASE "late_checkout"
    WHEN '4pm-confirmed' THEN 'honoured'
    WHEN 'on-request' THEN 'honoured'
    WHEN 'refused' THEN 'declined'
    WHEN 'not-needed' THEN 'not-requested'
    ELSE "late_checkout" END;
  DROP TYPE "public"."enum_reader_stays_late_checkout";
  CREATE TYPE "public"."enum_reader_stays_late_checkout" AS ENUM('honoured', 'declined', 'not-requested');
  ALTER TABLE "reader_stays" ALTER COLUMN "late_checkout" SET DATA TYPE "public"."enum_reader_stays_late_checkout" USING "late_checkout"::"public"."enum_reader_stays_late_checkout";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" ALTER COLUMN "late_checkout" SET DATA TYPE text;
  DROP TYPE "public"."enum_reader_stays_late_checkout";
  CREATE TYPE "public"."enum_reader_stays_late_checkout" AS ENUM('4pm-confirmed', 'on-request', 'refused', 'not-needed');
  ALTER TABLE "reader_stays" ALTER COLUMN "late_checkout" SET DATA TYPE "public"."enum_reader_stays_late_checkout" USING "late_checkout"::"public"."enum_reader_stays_late_checkout";`)
}
