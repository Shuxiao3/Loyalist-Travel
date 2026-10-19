import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Not live yet. Payload runs every file directly in src/migrations/, listed
// in index.ts or not, so this one waits in pending/. To ship it: once
// 20261019_010000 and the code reading articles_categories are live in
// production, move it up into src/migrations/ and register it in index.ts.
//
// Articles: drops the single category columns and their enums, which
// 20261019_010000 left in place for the code still serving the site while
// it deployed, along with the triggers that copied that code's saves into
// articles_categories. Before anything goes, an article or version that has
// an old category but no categories rows gets that one as its first, so a
// save that somehow missed the triggers is not lost with the column. Their
// indexes are dropped by name first, though Postgres would take them with
// the columns anyway.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP TRIGGER IF EXISTS "articles_category_copy_insert" ON "articles";
  DROP TRIGGER IF EXISTS "articles_category_copy_update" ON "articles";
  DROP TRIGGER IF EXISTS "_articles_v_version_category_copy_insert" ON "_articles_v";
  DROP TRIGGER IF EXISTS "_articles_v_version_category_copy_update" ON "_articles_v";
  DROP FUNCTION IF EXISTS "articles_category_copy"();
  DROP FUNCTION IF EXISTS "_articles_v_version_category_copy"();
  INSERT INTO "articles_categories" ("order", "parent_id", "value")
    SELECT 1, a."id", a."category"::text::"enum_articles_categories" FROM "articles" a
    WHERE a."category" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "articles_categories" c WHERE c."parent_id" = a."id") ORDER BY a."id";
  INSERT INTO "_articles_v_version_categories" ("order", "parent_id", "value")
    SELECT 1, v."id", v."version_category"::text::"enum__articles_v_version_categories" FROM "_articles_v" v
    WHERE v."version_category" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "_articles_v_version_categories" c WHERE c."parent_id" = v."id") ORDER BY v."id";
  DROP INDEX IF EXISTS "articles_category_idx";
  DROP INDEX IF EXISTS "_articles_v_version_version_category_idx";
  ALTER TABLE "articles" DROP COLUMN "category";
  ALTER TABLE "_articles_v" DROP COLUMN "version_category";
  DROP TYPE "public"."enum_articles_category";
  DROP TYPE "public"."enum__articles_v_version_category";`)
}

// Brings back what 20261019_010000 left: the columns, enums and indexes,
// each filled with the article's (or version's) first category, the lowest
// order, and the triggers that copy the old code's saves across.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_articles_category" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  CREATE TYPE "public"."enum__articles_v_version_category" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  ALTER TABLE "articles" ADD COLUMN "category" "enum_articles_category";
  ALTER TABLE "_articles_v" ADD COLUMN "version_category" "enum__articles_v_version_category";
  UPDATE "articles" SET "category" = c."value"::text::"enum_articles_category"
    FROM (SELECT DISTINCT ON ("parent_id") "parent_id", "value" FROM "articles_categories" ORDER BY "parent_id", "order", "id") c
    WHERE c."parent_id" = "articles"."id";
  UPDATE "_articles_v" SET "version_category" = c."value"::text::"enum__articles_v_version_category"
    FROM (SELECT DISTINCT ON ("parent_id") "parent_id", "value" FROM "_articles_v_version_categories" ORDER BY "parent_id", "order", "id") c
    WHERE c."parent_id" = "_articles_v"."id";
  CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category");
  CREATE INDEX "_articles_v_version_version_category_idx" ON "_articles_v" USING btree ("version_category");
  CREATE FUNCTION "articles_category_copy"() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    DELETE FROM "articles_categories" WHERE "parent_id" = NEW."id";
    INSERT INTO "articles_categories" ("order", "parent_id", "value") VALUES (1, NEW."id", NEW."category"::text::"enum_articles_categories");
    RETURN NULL;
  END $$;
  CREATE FUNCTION "_articles_v_version_category_copy"() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    DELETE FROM "_articles_v_version_categories" WHERE "parent_id" = NEW."id";
    INSERT INTO "_articles_v_version_categories" ("order", "parent_id", "value") VALUES (1, NEW."id", NEW."version_category"::text::"enum__articles_v_version_categories");
    RETURN NULL;
  END $$;
  CREATE TRIGGER "articles_category_copy_insert" AFTER INSERT ON "articles"
    FOR EACH ROW WHEN (NEW."category" IS NOT NULL) EXECUTE FUNCTION "articles_category_copy"();
  CREATE TRIGGER "articles_category_copy_update" AFTER UPDATE OF "category" ON "articles"
    FOR EACH ROW WHEN (NEW."category" IS NOT NULL AND NEW."category" IS DISTINCT FROM OLD."category") EXECUTE FUNCTION "articles_category_copy"();
  CREATE TRIGGER "_articles_v_version_category_copy_insert" AFTER INSERT ON "_articles_v"
    FOR EACH ROW WHEN (NEW."version_category" IS NOT NULL) EXECUTE FUNCTION "_articles_v_version_category_copy"();
  CREATE TRIGGER "_articles_v_version_category_copy_update" AFTER UPDATE OF "version_category" ON "_articles_v"
    FOR EACH ROW WHEN (NEW."version_category" IS NOT NULL AND NEW."version_category" IS DISTINCT FROM OLD."version_category") EXECUTE FUNCTION "_articles_v_version_category_copy"();`)
}
