/* eslint-disable @typescript-eslint/no-explicit-any */
// Runs the real migration in an in-process Postgres (PGlite) and checks the SQL
// functions, row level security, and a full import of the real JSON file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { buildImportPlan } from "../src/lib/import/diff";
import { parseVocabularyFile } from "../src/lib/import/parse";
import { toSavePayload } from "../src/lib/import/payload";
import { buildExport } from "../src/lib/export/build";
import type { ExistingState } from "../src/lib/import/types";

const REAL = process.argv[2] ?? "/mnt/user-data/uploads/merged_vocabulary_fixed.json";
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const db = new PGlite();
let n = 0;
const ok = async (name: string, fn: () => Promise<void> | void) => (await fn(), console.log(`  ✓ ${name}`), n++);

// Minimal stand-ins for what Supabase provides.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public, auth to authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`);
const migration = readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8")
  .replace("create extension if not exists pgcrypto;", ""); // gen_random_uuid() is built in since PG13
await db.exec(migration);
await db.exec(readFileSync(new URL("../supabase/migrations/0002_update_word.sql", import.meta.url), "utf8"));
await db.exec(`grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`);

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}
const q = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const save = (p: object, mode = "insert") => q<{ save_word: string }>("select save_word($1::jsonb, $2)", [JSON.stringify(p), mode]);

console.log("Schema and functions");
let catGeneral = "";
await as(A, async () => {
  catGeneral = (await q<{ id: string }>("insert into categories(name, description) values ('General', '') returning id"))[0].id;
});
await ok("save_word inserts a word with definitions, examples and a category", async () => {
  await as(A, async () => {
    await save({
      term: "Serendipity", word_type: "word", parts_of_speech: ["noun"], notes: "my note", priority: "important",
      sources: ["data.json"], extra: { mood: "x" }, is_favorite: true,
      definitions: [{ meaning: "A fortunate accident.", example: "Pure luck." }, { meaning: "Second sense.", example: "" }],
      extra_examples: ["Another sentence."], category_ids: [catGeneral],
    });
    const w = (await q<any>("select * from words"))[0];
    assert.equal(w.term_key, "serendipity");
    assert.equal(w.is_favorite, true);
    assert.deepEqual(w.extra, { mood: "x" });
    const d = await q<any>("select meaning from definitions order by position");
    assert.deepEqual(d.map((x) => x.meaning), ["A fortunate accident.", "Second sense."]);
    assert.equal((await q("select 1 from word_examples")).length, 1);
    assert.equal((await q("select 1 from word_categories")).length, 1);
  });
});
await ok("duplicate (any case/spacing) is refused in insert mode", async () => {
  await as(A, async () => {
    await assert.rejects(() => save({ term: "  serendipity ", definitions: [] }), /duplicate_word/);
  });
});
await ok("merge adds new info but never overwrites notes, type, or definitions", async () => {
  await as(A, async () => {
    await save({
      term: "serendipity", word_type: "idiom", notes: "file note", priority: "other",
      definitions: [{ meaning: "a fortunate accident.", example: "ignored: example already exists" }, { meaning: "Third sense.", example: "e3" }],
      sources: ["vocab.json"], screenshots: ["s1"],
    }, "merge");
    const w = (await q<any>("select * from words"))[0];
    assert.equal(w.word_type, "word"); // kept
    assert.equal(w.priority, "important"); // kept
    assert.equal(w.notes, "my note\n\nfile note"); // appended, not replaced
    assert.deepEqual([...w.sources].sort(), ["data.json", "vocab.json"]);
    assert.deepEqual(w.screenshots, ["s1"]);
    const d = await q<any>("select meaning, example from definitions order by position");
    assert.equal(d.length, 3);
    assert.equal(d[0].example, "Pure luck."); // untouched
    assert.equal(w.extra.mood, "x");
  });
});
await ok("merge fills a blank example on an existing definition", async () => {
  await as(A, async () => {
    await save({ term: "serendipity", definitions: [{ meaning: "Second sense.", example: "Now has one." }] }, "merge");
    const d = await q<any>("select example from definitions where meaning = 'Second sense.'");
    assert.equal(d[0].example, "Now has one.");
  });
});
await ok("save_words reports one bad item and still saves the rest", async () => {
  await as(A, async () => {
    const out = await q<{ save_words: { saved: number; failed: { term: string; error: string }[] } }>(
      "select save_words($1::jsonb)",
      [JSON.stringify([
        { _mode: "insert", term: "alpha", definitions: [{ meaning: "a", example: "" }] },
        { _mode: "insert", term: "Serendipity", definitions: [] },
        { _mode: "insert", term: "beta", definitions: [], category_ids: ["00000000-0000-0000-0000-000000000000"] },
        { _mode: "insert", term: "gamma", definitions: [] },
      ])],
    );
    const r = out[0].save_words;
    assert.equal(r.saved, 2);
    assert.deepEqual(r.failed.map((f) => f.term).sort(), ["Serendipity", "beta"]);
    assert.equal(r.failed.find((f) => f.term === "Serendipity")!.error, "Already in your dictionary");
    assert.equal((await q("select 1 from words where term_key = 'beta'")).length, 0); // rolled back
  });
});
await ok("deleting a category keeps the words", async () => {
  await as(A, async () => {
    await q("delete from categories where id = $1", [catGeneral]);
    assert.equal((await q("select 1 from words where term_key = 'serendipity'")).length, 1);
    assert.equal((await q("select 1 from word_categories")).length, 0);
  });
});

console.log("Row level security");
await ok("another user sees none of A's data", async () => {
  await as(B, async () => {
    for (const t of ["words", "definitions", "categories", "word_categories", "word_examples", "differences"])
      assert.equal((await q(`select 1 from ${t}`)).length, 0, t);
  });
});
await ok("another user cannot write rows owned by A", async () => {
  await as(B, async () => {
    await assert.rejects(() => q(`insert into words(user_id, term) values ('${A}', 'sneaky')`), /row-level security/);
  });
});
await ok("another user cannot link their word to A's category", async () => {
  let aCat = "";
  await as(A, async () => { aCat = (await q<{ id: string }>("insert into categories(name) values ('Private') returning id"))[0].id; });
  await as(B, async () => {
    await assert.rejects(() => save({ term: "mine", definitions: [], category_ids: [aCat] }), /unknown category/);
  });
});
await ok("the same word can exist for two users", async () => {
  await as(B, async () => { await save({ term: "serendipity", definitions: [] }); });
  await as(B, async () => assert.equal((await q("select 1 from words")).length, 1));
});

await ok("update_word replaces editable parts atomically, keeps priority/sources, blocks duplicates", async () => {
  await as(B, async () => {
    const id = (await q<any>("select id from words where term_key = 'serendipity'"))[0].id;
    await save({ term: "other", definitions: [] });
    await q("update words set priority = 'important', sources = array['s'] where id = $1", [id]);
    const upd = (p: object) => q("select update_word($1, $2::jsonb)", [id, JSON.stringify(p)]);
    await upd({ term: "Serendipity!", word_type: "word", notes: "n", is_favorite: true,
      definitions: [{ meaning: "one", example: "e" }, { meaning: "two", example: "" }], extra_examples: ["x"] });
    const w = (await q<any>("select * from words where id = $1", [id]))[0];
    assert.equal(w.term, "Serendipity!");
    assert.equal(w.priority, "important");
    assert.deepEqual(w.sources, ["s"]);
    assert.deepEqual((await q<any>("select meaning from definitions where word_id = $1 order by position", [id])).map((r) => r.meaning), ["one", "two"]);
    await assert.rejects(() => upd({ term: " OTHER ", definitions: [] }), /duplicate_word/);
    assert.equal((await q<any>("select term from words where id = $1", [id]))[0].term, "Serendipity!");
  });
  await as(A, async () => {
    const aid = (await q<any>("select id from words limit 1"))[0].id;
    await as(B, async () => {
      await assert.rejects(() => q("select update_word($1, $2::jsonb)", [aid, JSON.stringify({ term: "hack", definitions: [] })]), /word not found/);
    });
  });
});

console.log("Full import of the real JSON into a fresh account");
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
await db.exec(`insert into auth.users values ('${C}')`);
const real = parseVocabularyFile("merged_vocabulary_fixed.json", readFileSync(REAL, "utf8"));
const empty = (): ExistingState => ({ words: new Map(), categories: new Map(), differences: new Map() });
const plan = buildImportPlan([real], empty(), "add_only");

await as(C, async () => {
  for (const c of plan.categories)
    await q("insert into categories(name, description) values ($1, $2)", [c.name, c.description]);
  const ids = new Map((await q<any>("select id, name from categories")).map((r) => [r.name.toLowerCase(), r.id as string]));
  const items = plan.words.map((pw) => toSavePayload(pw, (name) => ids.get(name.toLowerCase())));
  let saved = 0;
  const failed: unknown[] = [];
  for (let i = 0; i < items.length; i += 60) {
    const r = (await q<any>("select save_words($1::jsonb)", [JSON.stringify(items.slice(i, i + 60))]))[0].save_words;
    saved += r.saved;
    failed.push(...r.failed);
  }
  for (const d of plan.differences) {
    const x = d.difference;
    await q("insert into differences(title, items, explanation, examples, origin, extra) values ($1,$2,$3,$4,$5,$6)",
      [x.title, x.items, x.explanation, x.examples, x.origin, JSON.stringify(x.extra)]);
  }
  await ok("all 735 words saved, none failed", () => {
    assert.equal(saved, 735);
    assert.deepEqual(failed, []);
  });
  await ok("836 definitions, 735 category links, 17 categories, 52 differences", async () => {
    assert.equal((await q<any>("select count(*)::int c from definitions"))[0].c, 836);
    assert.equal((await q<any>("select count(*)::int c from word_categories"))[0].c, 735);
    assert.equal((await q<any>("select count(*)::int c from categories"))[0].c, 17);
    assert.equal((await q<any>("select count(*)::int c from differences"))[0].c, 52);
  });
  await ok("fields round-trip: screenshots, sources, priority, type, notes, pos", async () => {
    const w = (await q<any>("select * from words where term_key = 'agonizing'"))[0];
    assert.deepEqual(w.parts_of_speech, ["adjective"]);
    assert.deepEqual(w.screenshots, ["Screenshot_20260927-023617"]);
    assert.match(w.notes, /Synonyms: excruciating/);
    assert.equal((await q<any>("select count(*)::int c from words where priority = 'important'"))[0].c, 190);
    assert.equal((await q<any>("select count(*)::int c from words where array_length(screenshots,1) > 0"))[0].c, 259);
    assert.equal((await q<any>("select count(*)::int c from words where word_type = 'idiom'"))[0].c, 29);
  });
  await ok("multi-definition ordering preserved (reception)", async () => {
    const d = await q<any>(`select d.meaning from definitions d join words w on w.id = d.word_id
                            where w.term_key = 'reception' order by d.position`);
    assert.equal(d.length, 4);
    assert.match(d[0].meaning, /formal welcome/);
    assert.match(d[3].meaning, /radio, TV, or phone signal/);
  });
  await ok("re-importing in add-only mode would change nothing (all skipped)", async () => {
    const existing: ExistingState = { words: new Map(), categories: new Map(), differences: new Map() };
    for (const r of await q<any>("select term_key, term from words"))
      existing.words.set(r.term_key, { id: "x", key: r.term_key, term: r.term, wordType: "", partsOfSpeech: [], notes: "", priority: "", favorite: false, sources: [], screenshots: [], definitions: [], extraExamples: [], categories: [] });
    for (const r of await q<any>("select title_key, title from differences"))
      existing.differences.set(r.title_key, { id: "d", title: r.title, items: [], explanation: "", examples: [], extra: {} });
    for (const r of await q<any>("select id, name from categories"))
      existing.categories.set(r.name.toLowerCase(), { id: r.id, name: r.name, description: "x" });
    const again = buildImportPlan([real], existing, "add_only");
    assert.equal(again.summary.wordsAdd + again.summary.diffsAdd + again.summary.categoriesAdd, 0);
    assert.equal(again.summary.wordsSkip, 735);
  });

  await ok("export round-trips: re-importing the export changes nothing and loses nothing", async () => {
    const rows = {
      words: await q<any>("select id, term, word_type, parts_of_speech, notes, is_favorite, priority, sources, screenshots, extra from words"),
      definitions: await q<any>("select word_id, position, meaning, example from definitions"),
      examples: await q<any>("select word_id, position, sentence from word_examples"),
      links: await q<any>("select word_id, category_id from word_categories"),
      categories: await q<any>("select id, name, description from categories"),
      differences: await q<any>("select title, items, explanation, examples, origin, extra from differences"),
    };
    const exported = JSON.stringify(buildExport(rows));
    const back = parseVocabularyFile("export.json", exported);
    assert.equal(back.rejected.length, 0);
    assert.equal(back.words.length, 735);
    assert.equal(back.differences.length, 52);
    // Same content as the original file, compared field by field.
    const orig = new Map(real.words.map((w) => [w.key, w]));
    for (const w of back.words) {
      const o = orig.get(w.key)!;
      assert.deepEqual(
        { ...w, categories: [...w.categories].sort() },
        { ...o, categories: [...o.categories].sort() },
        w.term,
      );
    }
    const od = new Map(real.differences.map((d) => [d.key, d]));
    for (const d of back.differences) assert.deepEqual(d, od.get(d.key), d.title);
  });
});

console.log(`\n${n} checks passed`);
