import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "logo_id" integer;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "programs_logo_idx" ON "programs" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP CONSTRAINT "programs_logo_id_media_id_fk";
  
  DROP INDEX "programs_logo_idx";
  ALTER TABLE "programs" DROP COLUMN "logo_id";`)
}
