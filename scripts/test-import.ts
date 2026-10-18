import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseVocabularyFile } from "../src/lib/import/parse";
import { buildImportPlan } from "../src/lib/import/diff";
import type { ExistingState, ExistingWord } from "../src/lib/import/types";

const REAL = process.argv[2] ?? "/mnt/user-data/uploads/merged_vocabulary_fixed.json";
const text = readFileSync(REAL, "utf8");
const empty = (): ExistingState => ({ words: new Map(), categories: new Map(), differences: new Map() });
let n = 0;
const ok = (name: string, fn: () => void) => (fn(), console.log(`  ✓ ${name}`), n++);

console.log("Real file");
const real = parseVocabularyFile("merged_vocabulary_fixed.json", text);
ok("detected as full dictionary, no fatal error", () => {
  assert.equal(real.format, "full-dictionary");
  assert.equal(real.fatal, undefined);
});
ok("735 words, 52 differences, 17 categories, 0 rejected", () => {
  assert.equal(real.words.length, 735);
  assert.equal(real.differences.length, 52);
  assert.equal(real.categories.length, 17);
  assert.equal(real.rejected.length, 0);
});
ok("category descriptions picked up", () =>
  assert.match(real.categories.find((c) => c.key === "slang and internet language")!.description, /Slang/));
ok("every field preserved (screenshots, priority, source, type, pos)", () => {
  const cause = real.words.find((w) => w.key === "cause")!;
  assert.deepEqual(cause.screenshots, ["Screenshot_20260923-150213"]);
  assert.deepEqual(cause.sources, ["vocabulary_database.json"]);
  assert.equal(cause.wordType, "word");
  assert.deepEqual(cause.categories, ["general vocabulary"]);
  const ag = real.words.find((w) => w.key === "agonizing")!;
  assert.deepEqual(ag.partsOfSpeech, ["adjective"]);
  assert.match(ag.notes, /Synonyms/);
  assert.equal(real.words.find((w) => w.key === "absence")!.priority, "important");
});
ok("total definitions preserved (836)", () =>
  assert.equal(real.words.reduce((s, w) => s + w.definitions.length, 0), 836));
ok("differences keep items/examples/origin", () => {
  const d = real.differences.find((x) => x.key === "affect vs effect")!;
  assert.deepEqual(d.items, ["affect", "effect"]);
  assert.equal(d.origin, "new");
  assert.equal(d.examples.length, 2);
});

console.log("Plan against an empty dictionary");
const p1 = buildImportPlan([real], empty(), "add_only");
ok("everything is an add", () => {
  assert.equal(p1.summary.wordsAdd, 735);
  assert.equal(p1.summary.wordsSkip + p1.summary.wordsUpdate, 0);
  assert.equal(p1.summary.diffsAdd, 52);
  assert.equal(p1.summary.categoriesAdd, 17);
});

console.log("Plan against an existing dictionary");
const existingWord = (over: Partial<ExistingWord>): ExistingWord => ({
  id: "w1", key: "cause", term: "cause", wordType: "word", partsOfSpeech: [], notes: "my own note",
  priority: "", favorite: false, sources: [], screenshots: [], extraExamples: [],
  definitions: [{ meaning: "My own definition of cause.", example: "" }], categories: ["my category"], ...over,
});
const st = empty();
st.words.set("cause", existingWord({}));
st.words.set("chaos", existingWord({
  id: "w2", key: "chaos", term: "chaos", priority: "important", sources: ["data.json"],
  definitions: [{ meaning: "Complete disorder and confusion.", example: "" }], categories: ["general vocabulary"],
  notes: "",
}));
st.categories.set("general vocabulary", { id: "c1", name: "General Vocabulary", description: "" });

const pa = buildImportPlan([real], st, "add_only");
ok("add-only: existing words are skipped and untouched", () => {
  assert.equal(pa.words.find((w) => w.key === "cause")!.action, "skip");
  assert.equal(pa.summary.wordsAdd, 733);
  assert.equal(pa.summary.wordsSkip, 2);
  assert.equal(pa.summary.categoriesAdd, 16);
  assert.equal(pa.categories.find((c) => c.name === "General Vocabulary")!.action, "skip");
});
const pm = buildImportPlan([real], st, "merge");
ok("merge: adds new info to existing words, never overwrites", () => {
  const cause = pm.words.find((w) => w.key === "cause")!;
  assert.equal(cause.action, "update");
  assert.ok(cause.changes.some((c) => c.includes("+1 definition")));
  assert.ok(cause.changes.includes("+ categories: general vocabulary"));
  assert.ok(cause.changes.some((c) => c.includes("screenshot")));
});
ok("merge: identical word has nothing to do and is skipped", () => {
  const chaos = pm.words.find((w) => w.key === "chaos")!;
  assert.equal(chaos.action, "skip", JSON.stringify(chaos.changes));
});
ok("merge: blank category description gets filled, nothing else", () => {
  assert.equal(pm.categories.find((c) => c.name === "General Vocabulary")!.action, "update");
});

console.log("Single-entry files");
const single = parseVocabularyFile("one.json", JSON.stringify({
  term: "serendipity", type: "word", part_of_speech: "noun",
  definitions: [{ meaning: "A fortunate accident.", example: "Pure serendipity." }],
}));
ok("single word, existing schema, minimal fields", () => {
  assert.equal(single.format, "single-word");
  assert.equal(single.words.length, 1);
  assert.deepEqual(single.words[0].partsOfSpeech, ["noun"]);
  assert.equal(single.words[0].definitions[0].example, "Pure serendipity.");
});
const shorthand = parseVocabularyFile("two.json", JSON.stringify({
  term: "Spill  the tea", meaning: "Share gossip.", example: "Spill the tea!", categories: ["slang"], mood: "cheeky",
}));
ok("shorthand entry; spaces collapsed; unknown field kept in extra", () => {
  const w = shorthand.words[0];
  assert.equal(w.term, "Spill the tea");
  assert.equal(w.definitions[0].meaning, "Share gossip.");
  assert.deepEqual(w.categories, ["slang"]);
  assert.deepEqual(w.extra, { mood: "cheeky" });
});
const singleDiff = parseVocabularyFile("d.json", JSON.stringify({
  items: ["lay", "lie"], explanation: "Lay needs an object.", examples: ["Lay it down."],
}));
ok("single difference", () => {
  assert.equal(singleDiff.format, "single-difference");
  assert.equal(singleDiff.differences[0].title, "lay vs lie");
});
const list = parseVocabularyFile("l.json", JSON.stringify([{ term: "a", definitions: [] }, { term: "" }, 5]));
ok("word list: valid kept, bad rejected with reason", () => {
  assert.equal(list.words.length, 1);
  assert.equal(list.rejected.length, 2);
  assert.match(list.rejected[0].reason, /term/);
});

console.log("Validation");
ok("invalid JSON is a clear fatal error", () => {
  const f = parseVocabularyFile("bad.json", "{ nope");
  assert.match(f.fatal!, /Not valid JSON/);
});
ok("unrecognised structure is a clear fatal error", () => {
  const f = parseVocabularyFile("x.json", JSON.stringify({ hello: 1 }));
  assert.match(f.fatal!, /Unrecognised structure/);
});
ok("non-empty review_queue is flagged, not silently dropped", () => {
  const f = parseVocabularyFile("r.json", JSON.stringify({ categories: {}, review_queue: [{ a: 1 }] }));
  assert.ok(f.warnings.some((w) => w.includes("review_queue")));
});

console.log("Multiple files / duplicates");
const fileA = parseVocabularyFile("a.json", JSON.stringify([
  { term: "Foo", type: "word", definitions: [{ meaning: "First sense.", example: "" }], categories: ["x"], notes: "note A" },
  { term: "bar", definitions: [{ meaning: "Bar sense.", example: "" }] },
]));
const fileB = parseVocabularyFile("b.json", JSON.stringify([
  { term: "foo", type: "idiom", definitions: [{ meaning: "Second sense.", example: "ex" }, { meaning: "first sense.", example: "filled example" }], categories: ["y"], notes: "note B" },
  { term: "bar", definitions: [{ meaning: "Bar sense.", example: "" }] },
]));
const pd = buildImportPlan([fileA, fileB, fileA], empty(), "add_only");
ok("duplicates across files are combined into one entry, nothing lost", () => {
  assert.equal(pd.words.length, 2);
  const foo = pd.words.find((w) => w.key === "foo")!;
  assert.equal(foo.word.definitions.length, 2);
  assert.equal(foo.word.definitions[0].example, "filled example");
  assert.deepEqual(foo.word.categories, ["x", "y"]);
  assert.match(foo.word.notes, /note A[\s\S]*note B/);
  assert.equal(foo.word.wordType, "word"); // first file wins, conflict reported
  assert.ok(foo.combined.some((c) => c.includes('kept "word"')));
  assert.deepEqual(foo.files, ["a.json", "b.json"]);
});
ok("identical duplicate is reported as such", () => {
  const bar = pd.words.find((w) => w.key === "bar")!;
  assert.ok(bar.combined.every((c) => c.includes("identical")));
});
ok("a bad file does not block the good ones", () => {
  const bad = parseVocabularyFile("bad.json", "[");
  const p = buildImportPlan([bad, fileA], empty(), "add_only");
  assert.equal(p.summary.wordsAdd, 2);
  assert.ok(p.files.find((f) => f.name === "bad.json")!.fatal);
});

console.log(`\n${n} checks passed`);
