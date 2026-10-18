// Builds the export JSON in the same shape the importer (and the original file) uses,
// so an export can always be re-imported without loss.

export type ExportRows = {
  words: {
    id: string; term: string; word_type: string | null; parts_of_speech: string[] | null; notes: string | null;
    is_favorite: boolean; priority: string | null; sources: string[] | null; screenshots: string[] | null;
    extra: Record<string, unknown> | null;
  }[];
  definitions: { word_id: string; position: number; meaning: string; example: string | null }[];
  examples: { word_id: string; position: number; sentence: string }[];
  links: { word_id: string; category_id: string }[];
  categories: { id: string; name: string; description: string | null }[];
  differences: {
    title: string; items: string[] | null; explanation: string | null; examples: string[] | null;
    origin: string | null; extra: Record<string, unknown> | null;
  }[];
};

const byTerm = (a: { term: string }, b: { term: string }) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" });

export function buildExport(r: ExportRows) {
  const defs = new Map<string, ExportRows["definitions"]>();
  for (const d of [...r.definitions].sort((a, b) => a.position - b.position)) {
    if (!defs.has(d.word_id)) defs.set(d.word_id, []);
    defs.get(d.word_id)!.push(d);
  }
  const exs = new Map<string, string[]>();
  for (const e of [...r.examples].sort((a, b) => a.position - b.position)) {
    if (!exs.has(e.word_id)) exs.set(e.word_id, []);
    exs.get(e.word_id)!.push(e.sentence);
  }
  const catName = new Map(r.categories.map((c) => [c.id, c.name]));
  const wordCats = new Map<string, string[]>();
  for (const l of r.links) {
    const n = catName.get(l.category_id);
    if (!n) continue;
    if (!wordCats.has(l.word_id)) wordCats.set(l.word_id, []);
    wordCats.get(l.word_id)!.push(n);
  }

  const entry = (w: ExportRows["words"][number], category?: string) => {
    const o: Record<string, unknown> = {
      ...(w.extra ?? {}),
      term: w.term,
      type: w.word_type ?? "",
      part_of_speech: w.parts_of_speech ?? [],
      definitions: (defs.get(w.id) ?? []).map((d) => ({ meaning: d.meaning, example: d.example ?? "" })),
      notes: w.notes ?? "",
      source: w.sources ?? [],
    };
    if (category) o.word_category = category;
    o.priority = w.priority ?? "";
    if (w.screenshots?.length) o.screenshots = w.screenshots;
    if (exs.get(w.id)?.length) o.extra_examples = exs.get(w.id);
    if (w.is_favorite) o.favorite = true;
    return o;
  };

  const sorted = [...r.words].sort(byTerm);
  const categories: Record<string, unknown[]> = {};
  for (const c of [...r.categories].sort((a, b) => a.name.localeCompare(b.name))) categories[c.name] = [];
  const uncategorized: unknown[] = [];
  for (const w of sorted) {
    const cats = wordCats.get(w.id) ?? [];
    if (!cats.length) uncategorized.push(entry(w));
    for (const c of cats) categories[c].push(entry(w, c));
  }

  const out: Record<string, unknown> = {
    category_descriptions: Object.fromEntries(r.categories.map((c) => [c.name, c.description ?? ""])),
    categories,
    Differences: r.differences.map((d) => ({
      ...(d.extra ?? {}),
      items: d.items ?? [],
      explanation: d.explanation ?? "",
      examples: d.examples ?? [],
      origin: d.origin ?? "",
    })),
  };
  if (uncategorized.length) out.words = uncategorized; // words with no category
  return out;
}
