import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Single-use sign-in links, for readers who would rather not use Google.
//
// Deliberately not a Payload collection: these rows live for fifteen minutes,
// hold a token hash and nothing an editor would ever want to read, and putting
// them in the admin would mean a collection of auth plumbing sitting beside the
// content. Read and written with plain SQL, as the stay recount already does.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "auth_sign_in_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "auth_sign_in_tokens_token_hash_idx" ON "auth_sign_in_tokens" USING btree ("token_hash");
  CREATE INDEX "auth_sign_in_tokens_email_idx" ON "auth_sign_in_tokens" USING btree ("email");
  CREATE INDEX "auth_sign_in_tokens_expires_at_idx" ON "auth_sign_in_tokens" USING btree ("expires_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE "auth_sign_in_tokens";`)
}
