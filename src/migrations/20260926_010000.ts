import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Brands carry a rank: their perceived place in the program's hierarchy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "brands" ADD COLUMN "rank" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "brands" DROP COLUMN "rank";`)
}
