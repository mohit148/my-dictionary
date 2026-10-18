import type {
  Definition,
  FileFormat,
  NormalizedDifference,
  NormalizedWord,
  ParsedFile,
} from "./types";

// ---------------------------------------------------------------- helpers

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
/** Must stay in sync with words.term_key = lower(btrim(term)). */
export const keyOf = (s: string) => collapse(s).toLowerCase();

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asStr = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
};

/** Accepts "a", ["a","b"], or undefined; returns de-duplicated non-empty strings. */
function strList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v == null || v === "" ? [] : [v];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const s = asStr(x);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

const WORD_KNOWN = new Set([
  "term", "word", "expression", "type", "part_of_speech", "definitions", "meaning",
  "definition", "example", "examples", "extra_examples", "notes", "source", "sources",
  "word_category", "category", "categories", "priority", "screenshots", "favorite",
  "is_favorite",
]);

const DIFF_KNOWN = new Set(["title", "items", "explanation", "examples", "origin"]);

// ------------------------------------------------------------ normalizers

type WordResult = { word: NormalizedWord; warnings: string[] } | { reject: string; label: string };

export function normalizeWord(raw: unknown, mapCategory?: string): WordResult {
  if (!isObj(raw)) {
    return { reject: "Entry is not an object", label: String(raw).slice(0, 40) };
  }
  const termRaw = asStr(raw.term ?? raw.word ?? raw.expression);
  if (!termRaw) return { reject: "Missing or empty \"term\"", label: "(no term)" };

  const warnings: string[] = [];
  const term = collapse(termRaw);
  const extraExamples = strList(raw.extra_examples);

  // examples given as a top-level list (single-entry convenience)
  for (const s of strList(raw.examples)) extraExamples.push(s);

  const definitions: Definition[] = [];
  const pushDef = (meaning: unknown, example: unknown) => {
    const m = asStr(meaning) ?? "";
    const ex = Array.isArray(example) ? strList(example).join(" / ") : asStr(example) ?? "";
    if (m) definitions.push({ meaning: m, example: ex });
    else if (ex) {
      extraExamples.push(ex);
      warnings.push(`"${term}": an example had no definition, kept as an extra example`);
    }
  };

  if (raw.definitions !== undefined) {
    if (!Array.isArray(raw.definitions)) {
      warnings.push(`"${term}": "definitions" is not a list, treated as one definition`);
      pushDef(raw.definitions, "");
    } else {
      for (const d of raw.definitions) {
        if (typeof d === "string") pushDef(d, "");
        else if (isObj(d)) pushDef(d.meaning ?? d.definition, d.example ?? d.examples);
      }
    }
  }
  // single-entry shorthand: { term, meaning, example }
  if (raw.meaning !== undefined || raw.definition !== undefined) {
    pushDef(raw.meaning ?? raw.definition, raw.example);
  }

  const categories = [
    ...(mapCategory ? [mapCategory] : []),
    ...strList(raw.word_category),
    ...strList(raw.category),
    ...strList(raw.categories),
  ];
  const catSeen = new Set<string>();
  const cats = categories
    .map(collapse)
    .filter((c) => c && !catSeen.has(c.toLowerCase()) && catSeen.add(c.toLowerCase()));

  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!WORD_KNOWN.has(k)) extra[k] = v;
  }

  let notes = "";
  if (typeof raw.notes === "string") notes = raw.notes.trim();
  else if (Array.isArray(raw.notes)) notes = strList(raw.notes).join("\n");
  else if (raw.notes != null) {
    extra.notes = raw.notes;
    warnings.push(`"${term}": "notes" had an unexpected type and was kept as extra data`);
  }

  const fav = raw.favorite ?? raw.is_favorite;
  return {
    word: {
      term,
      key: keyOf(term),
      wordType: asStr(raw.type) ?? "",
      partsOfSpeech: strList(raw.part_of_speech),
      definitions,
      extraExamples,
      notes,
      sources: strList(raw.source ?? raw.sources),
      screenshots: strList(raw.screenshots),
      priority: asStr(raw.priority) ?? "",
      favorite: fav === true || fav === "true",
      categories: cats,
      extra,
    },
    warnings,
  };
}

type DiffResult = { diff: NormalizedDifference } | { reject: string; label: string };

export function normalizeDifference(raw: unknown): DiffResult {
  if (!isObj(raw)) return { reject: "Entry is not an object", label: String(raw).slice(0, 40) };
  const items = strList(raw.items);
  const title = collapse(asStr(raw.title) ?? items.join(" vs "));
  if (!title) return { reject: "No \"items\" or \"title\" to name the comparison", label: "(untitled)" };
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!DIFF_KNOWN.has(k)) extra[k] = v;
  return {
    diff: {
      title,
      key: keyOf(title),
      items,
      explanation: asStr(raw.explanation) ?? "",
      examples: strList(raw.examples),
      origin: asStr(raw.origin) ?? "",
      extra,
    },
  };
}

// ----------------------------------------------------------------- parser

const looksLikeWord = (v: unknown) =>
  isObj(v) && (typeof v.term === "string" || typeof v.word === "string" || typeof v.expression === "string");
const looksLikeDiff = (v: unknown) => isObj(v) && Array.isArray(v.items);

export function parseVocabularyFile(name: string, text: string): ParsedFile {
  const out: ParsedFile = {
    name, format: "unknown", words: [], differences: [], categories: [], rejected: [], warnings: [],
  };

  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    out.fatal = `Not valid JSON: ${(e as Error).message}`;
    return out;
  }

  const addWord = (raw: unknown, where: string, mapCategory?: string) => {
    const r = normalizeWord(raw, mapCategory);
    if ("reject" in r) out.rejected.push({ file: name, where, label: r.label, reason: r.reject });
    else {
      out.words.push(r.word);
      out.warnings.push(...r.warnings);
    }
  };
  const addDiff = (raw: unknown, where: string) => {
    const r = normalizeDifference(raw);
    if ("reject" in r) out.rejected.push({ file: name, where, label: r.label, reason: r.reject });
    else out.differences.push(r.diff);
  };
  const addCategory = (catName: string, description: unknown) => {
    const n = collapse(catName);
    if (!n) return;
    const existing = out.categories.find((c) => c.key === n.toLowerCase());
    const desc = asStr(description) ?? "";
    if (existing) {
      if (!existing.description) existing.description = desc;
    } else out.categories.push({ name: n, key: n.toLowerCase(), description: desc });
  };

  const mixedList = (arr: unknown[], where: string) => {
    arr.forEach((item, i) => {
      if (looksLikeDiff(item) && !looksLikeWord(item)) addDiff(item, `${where}[${i}]`);
      else addWord(item, `${where}[${i}]`);
    });
  };

  let format: FileFormat = "unknown";

  if (Array.isArray(json)) {
    if (json.length && json.every(looksLikeDiff) && !json.some(looksLikeWord)) format = "differences";
    else format = "word-list";
    mixedList(json, "$");
  } else if (isObj(json)) {
    const handled = new Set<string>();

    if (isObj(json.categories)) {
      format = "full-dictionary";
      handled.add("categories");
      for (const [cat, list] of Object.entries(json.categories)) {
        addCategory(cat, undefined);
        if (!Array.isArray(list)) {
          out.rejected.push({
            file: name, where: `categories["${cat}"]`, label: cat,
            reason: "Category value is not a list of entries",
          });
          continue;
        }
        list.forEach((e, i) => addWord(e, `categories["${cat}"][${i}]`, cat));
      }
    }
    if (isObj(json.category_descriptions)) {
      handled.add("category_descriptions");
      for (const [cat, d] of Object.entries(json.category_descriptions)) addCategory(cat, d);
    }
    const diffs = json.Differences ?? json.differences;
    if (Array.isArray(diffs)) {
      handled.add("Differences").add("differences");
      if (format === "unknown") format = "differences";
      diffs.forEach((d, i) => addDiff(d, `Differences[${i}]`));
    }
    if (Array.isArray(json.words)) {
      handled.add("words");
      if (format === "unknown") format = "word-list";
      mixedList(json.words, "words");
    }
    if (format === "unknown") {
      if (looksLikeWord(json)) {
        format = "single-word";
        addWord(json, "$");
        handled.clear();
        Object.keys(json).forEach((k) => handled.add(k));
      } else if (looksLikeDiff(json)) {
        format = "single-difference";
        addDiff(json, "$");
        Object.keys(json).forEach((k) => handled.add(k));
      }
    }

    if (Array.isArray(json.review_queue) && json.review_queue.length) {
      out.warnings.push(
        `${json.review_queue.length} item(s) in "review_queue" are not imported (this app has no review queue)`,
      );
      handled.add("review_queue");
    } else if ("review_queue" in json) handled.add("review_queue");

    const unknownKeys = Object.keys(json).filter((k) => !handled.has(k));
    if (unknownKeys.length && format !== "unknown") {
      out.warnings.push(`Top-level fields not imported: ${unknownKeys.join(", ")}`);
    }
  }

  out.format = format;
  if (format === "unknown") {
    out.fatal = isObj(json)
      ? `Unrecognised structure. Top-level fields: ${Object.keys(json).slice(0, 8).join(", ") || "(none)"}. ` +
        `Expected a "categories" map, a list of entries, a single entry with "term", or "Differences".`
      : "Unrecognised structure: expected an object or a list of entries.";
  } else if (!out.words.length && !out.differences.length && !out.categories.length && !out.rejected.length) {
    out.warnings.push("The file is valid but contains no entries.");
  }
  return out;
}
