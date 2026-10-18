import type {
  Definition,
  ExistingDifference,
  ExistingState,
  ExistingWord,
  ImportMode,
  ImportPlan,
  NormalizedCategory,
  NormalizedDifference,
  NormalizedWord,
  ParsedFile,
  PlanCategory,
  PlanDifference,
  PlanWord,
} from "./types";

const lc = (s: string) => s.trim().toLowerCase();
const defKey = (d: Definition) => lc(d.meaning);
const snippet = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function union(a: string[], b: string[]): string[] {
  const seen = new Set(a.map(lc));
  const out = [...a];
  for (const x of b) {
    if (seen.has(lc(x))) continue;
    seen.add(lc(x));
    out.push(x);
  }
  return out;
}
const missing = (have: string[], incoming: string[]) => {
  const h = new Set(have.map(lc));
  return incoming.filter((x) => !h.has(lc(x)));
};

/** Notes are never overwritten: blank gets filled, different text is appended. */
function mergeNotes(base: string, incoming: string): { value: string; how: "same" | "filled" | "appended" } {
  if (!incoming.trim() || base.includes(incoming)) return { value: base, how: "same" };
  if (!base.trim()) return { value: incoming, how: "filled" };
  return { value: `${base}\n\n${incoming}`, how: "appended" };
}

// ------------------------------------------------ combine duplicates in files

function combineWords(base: NormalizedWord, inc: NormalizedWord, file: string): { word: NormalizedWord; note: string } {
  const notes: string[] = [];
  const defs = base.definitions.map((d) => ({ ...d }));
  const extraExamples = [...base.extraExamples];
  let newDefs = 0;
  for (const d of inc.definitions) {
    const hit = defs.find((x) => defKey(x) === defKey(d));
    if (!hit) {
      defs.push({ ...d });
      newDefs++;
    } else if (!hit.example && d.example) hit.example = d.example;
    else if (d.example && d.example !== hit.example && !extraExamples.includes(d.example)) {
      extraExamples.push(d.example);
      notes.push("a differing example was kept as an extra example");
    }
  }
  const extraNew = missing(extraExamples, inc.extraExamples);
  extraExamples.push(...extraNew);
  const n = mergeNotes(base.notes, inc.notes);
  const cats = union(base.categories, inc.categories);
  const sources = union(base.sources, inc.sources);

  if (newDefs) notes.push(`${newDefs} extra definition(s)`);
  if (cats.length > base.categories.length) notes.push("extra categories");
  if (n.how === "appended") notes.push("notes from both kept");
  if (base.wordType && inc.wordType && lc(base.wordType) !== lc(inc.wordType))
    notes.push(`type "${inc.wordType}" ignored, kept "${base.wordType}"`);

  const word: NormalizedWord = {
    ...base,
    wordType: base.wordType || inc.wordType,
    partsOfSpeech: union(base.partsOfSpeech, inc.partsOfSpeech),
    definitions: defs,
    extraExamples,
    notes: n.value,
    sources,
    screenshots: union(base.screenshots, inc.screenshots),
    priority: base.priority || inc.priority,
    favorite: base.favorite || inc.favorite,
    categories: cats,
    extra: { ...inc.extra, ...base.extra },
  };
  const detail = notes.length ? `combined (${notes.join("; ")})` : "identical, merged into one";
  return { word, note: `Also in ${file}: ${detail}` };
}

function combineDiffs(base: NormalizedDifference, inc: NormalizedDifference, file: string) {
  const notes: string[] = [];
  const extra = { ...inc.extra, ...base.extra };
  let explanation = base.explanation;
  if (!explanation) explanation = inc.explanation;
  else if (inc.explanation && lc(inc.explanation) !== lc(explanation)) {
    const alt = Array.isArray(extra.alternate_explanations) ? (extra.alternate_explanations as string[]) : [];
    extra.alternate_explanations = union(alt, [inc.explanation]);
    notes.push("a different explanation was kept as an alternate");
  }
  const examples = union(base.examples, inc.examples);
  if (examples.length > base.examples.length) notes.push("extra examples");
  const diff: NormalizedDifference = {
    ...base,
    items: union(base.items, inc.items),
    explanation,
    examples,
    origin: base.origin || inc.origin,
    extra,
  };
  return {
    diff,
    note: `Also in ${file}: ${notes.length ? `combined (${notes.join("; ")})` : "identical, merged into one"}`,
  };
}

// --------------------------------------------------- compare with the database

function wordChanges(ex: ExistingWord, w: NormalizedWord) {
  const changes: string[] = [];
  const kept: string[] = [];

  const newDefs = w.definitions.filter((d) => !ex.definitions.some((x) => defKey(x) === defKey(d)));
  if (newDefs.length) changes.push(`+${newDefs.length} definition${newDefs.length > 1 ? "s" : ""}`);

  for (const d of w.definitions) {
    const hit = ex.definitions.find((x) => defKey(x) === defKey(d));
    if (hit && !hit.example.trim() && d.example.trim()) changes.push(`example added to "${snippet(d.meaning, 28)}"`);
  }
  const newEx = missing(ex.extraExamples, w.extraExamples);
  if (newEx.length) changes.push(`+${newEx.length} example sentence${newEx.length > 1 ? "s" : ""}`);

  const newCats = missing(ex.categories, w.categories);
  if (newCats.length) changes.push(`+ categories: ${newCats.join(", ")}`);

  const n = mergeNotes(ex.notes, w.notes);
  if (n.how === "filled") changes.push("notes added");
  if (n.how === "appended") changes.push("notes appended below yours");

  if (w.wordType) {
    if (!ex.wordType.trim()) changes.push(`type set to "${w.wordType}"`);
    else if (lc(ex.wordType) !== lc(w.wordType)) kept.push(`type "${ex.wordType}" (file says "${w.wordType}")`);
  }
  if (w.priority) {
    if (!ex.priority.trim()) changes.push(`priority set to "${w.priority}"`);
    else if (lc(ex.priority) !== lc(w.priority)) kept.push(`priority "${ex.priority}" (file says "${w.priority}")`);
  }
  const pos = missing(ex.partsOfSpeech, w.partsOfSpeech);
  if (pos.length) changes.push(`+ part of speech: ${pos.join(", ")}`);
  const src = missing(ex.sources, w.sources);
  if (src.length) changes.push(`+${src.length} source${src.length > 1 ? "s" : ""}`);
  const shots = missing(ex.screenshots, w.screenshots);
  if (shots.length) changes.push(`+${shots.length} screenshot reference${shots.length > 1 ? "s" : ""}`);
  if (w.favorite && !ex.favorite) changes.push("marked as favorite");
  return { changes, kept };
}

function diffChanges(ex: ExistingDifference, d: NormalizedDifference) {
  const changes: string[] = [];
  const kept: string[] = [];
  let explanation = ex.explanation;
  const extra = { ...d.extra, ...ex.extra };
  if (!ex.explanation.trim() && d.explanation) {
    explanation = d.explanation;
    changes.push("explanation added");
  } else if (d.explanation && lc(d.explanation) !== lc(ex.explanation)) {
    kept.push("explanation (file has a different one)");
  }
  const newEx = missing(ex.examples, d.examples);
  if (newEx.length) changes.push(`+${newEx.length} example${newEx.length > 1 ? "s" : ""}`);
  const extraKeysNew = Object.keys(d.extra).filter((k) => !(k in ex.extra));
  if (extraKeysNew.length) changes.push(`+ extra fields: ${extraKeysNew.join(", ")}`);
  return {
    changes,
    kept,
    update: { id: ex.id, explanation, examples: union(ex.examples, d.examples), extra },
  };
}

// -------------------------------------------------------------------- plan

export function buildImportPlan(files: ParsedFile[], existing: ExistingState, mode: ImportMode): ImportPlan {
  // 1) combine duplicates within and across files (first occurrence wins)
  const words = new Map<string, { word: NormalizedWord; files: string[]; combined: string[] }>();
  const diffs = new Map<string, { diff: NormalizedDifference; files: string[]; combined: string[] }>();
  const cats = new Map<string, NormalizedCategory>();

  for (const f of files) {
    if (f.fatal) continue;
    for (const w of f.words) {
      const hit = words.get(w.key);
      if (!hit) words.set(w.key, { word: w, files: [f.name], combined: [] });
      else {
        const r = combineWords(hit.word, w, f.name);
        hit.word = r.word;
        hit.combined.push(r.note);
        if (!hit.files.includes(f.name)) hit.files.push(f.name);
      }
    }
    for (const d of f.differences) {
      const hit = diffs.get(d.key);
      if (!hit) diffs.set(d.key, { diff: d, files: [f.name], combined: [] });
      else {
        const r = combineDiffs(hit.diff, d, f.name);
        hit.diff = r.diff;
        hit.combined.push(r.note);
        if (!hit.files.includes(f.name)) hit.files.push(f.name);
      }
    }
    for (const c of f.categories) {
      const hit = cats.get(c.key);
      if (!hit) cats.set(c.key, { ...c });
      else if (!hit.description) hit.description = c.description;
    }
  }
  // categories referenced by words but missing from any category list
  for (const { word } of words.values())
    for (const name of word.categories)
      if (!cats.has(lc(name))) cats.set(lc(name), { name, key: lc(name), description: "" });

  // 2) compare with the database
  const planWords: PlanWord[] = [];
  for (const [key, { word, files: from, combined }] of words) {
    const ex = existing.words.get(key);
    let action: PlanWord["action"] = "add";
    let reason = "Not in your dictionary yet";
    let changes: string[] = [];
    let kept: string[] = [];
    if (ex) {
      if (mode === "add_only") {
        action = "skip";
        reason = "Already in your dictionary (add-new-only mode keeps it untouched)";
      } else {
        const r = wordChanges(ex, word);
        changes = r.changes;
        kept = r.kept;
        if (changes.length) {
          action = "update";
          reason = "Already in your dictionary; new information will be merged in";
        } else {
          action = "skip";
          reason = "Already in your dictionary; nothing new to add";
        }
      }
    }
    planWords.push({ key, term: word.term, action, reason, changes, kept, combined, files: from, word });
  }
  planWords.sort((a, b) => a.key.localeCompare(b.key));

  const planDiffs: PlanDifference[] = [];
  for (const [key, { diff, files: from, combined }] of diffs) {
    const ex = existing.differences.get(key);
    const p: PlanDifference = {
      key, title: diff.title, action: "add", reason: "Not in your Differences yet",
      changes: [], kept: [], combined, files: from, difference: diff,
    };
    if (ex) {
      if (mode === "add_only") {
        p.action = "skip";
        p.reason = "Already in your Differences (add-new-only mode keeps it untouched)";
      } else {
        const r = diffChanges(ex, diff);
        p.kept = r.kept;
        p.changes = r.changes;
        if (r.changes.length) {
          p.action = "update";
          p.reason = "Already exists; new information will be merged in";
          p.update = r.update;
        } else {
          p.action = "skip";
          p.reason = "Already exists; nothing new to add";
        }
      }
    }
    planDiffs.push(p);
  }
  planDiffs.sort((a, b) => a.key.localeCompare(b.key));

  const planCats: PlanCategory[] = [];
  for (const c of [...cats.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const ex = existing.categories.get(c.key);
    if (!ex) planCats.push({ name: c.name, action: "add", description: c.description });
    else if (mode === "merge" && !ex.description.trim() && c.description)
      planCats.push({ name: ex.name, action: "update", description: c.description });
    else planCats.push({ name: ex.name, action: "skip", description: ex.description });
  }

  const rejected = files.flatMap((f) => f.rejected);
  const count = <T extends { action: string }>(l: T[], a: string) => l.filter((x) => x.action === a).length;
  return {
    mode,
    files: files.map((f) => ({
      name: f.name, format: f.format, words: f.words.length, differences: f.differences.length,
      rejected: f.rejected.length, warnings: f.warnings, fatal: f.fatal,
    })),
    words: planWords,
    differences: planDiffs,
    categories: planCats,
    rejected,
    summary: {
      wordsAdd: count(planWords, "add"),
      wordsUpdate: count(planWords, "update"),
      wordsSkip: count(planWords, "skip"),
      diffsAdd: count(planDiffs, "add"),
      diffsUpdate: count(planDiffs, "update"),
      diffsSkip: count(planDiffs, "skip"),
      categoriesAdd: count(planCats, "add"),
      rejected: rejected.length,
      duplicatesCombined:
        planWords.reduce((n, w) => n + w.combined.length, 0) + planDiffs.reduce((n, d) => n + d.combined.length, 0),
    },
  };
}
