import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Readers may change a display name once every six months, so record when they
// last did. Null means they have never changed one, which includes everyone who
// signed in before this.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "readers" ADD COLUMN "display_name_changed_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "readers" DROP COLUMN "display_name_changed_at";`)
}
