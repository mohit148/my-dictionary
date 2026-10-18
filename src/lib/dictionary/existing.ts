import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExistingState, ExistingWord } from "@/lib/import/types";

const PAGE = 1000;

type WordRow = {
  id: string; term: string; term_key: string; word_type: string | null; parts_of_speech: string[] | null;
  notes: string | null; priority: string | null; is_favorite: boolean; sources: string[] | null; screenshots: string[] | null;
};
type DefRow = { id: string; word_id: string; position: number; meaning: string; example: string | null };
type ExRow = { id: string; word_id: string; position: number; sentence: string };
type LinkRow = { word_id: string; category_id: string };
type CatRow = { id: string; name: string; description: string | null };
type DiffRow = {
  id: string; title: string; title_key: string; items: string[] | null; explanation: string | null;
  examples: string[] | null; extra: Record<string, unknown> | null;
};

/** Supabase returns at most 1000 rows per request, so page until exhausted. */
export async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadExistingState(supabase: SupabaseClient): Promise<ExistingState> {
  const [words, defs, exs, links, cats, diffs] = await Promise.all([
    fetchAll<WordRow>((a, b) =>
      supabase.from("words")
        .select("id, term, term_key, word_type, parts_of_speech, notes, priority, is_favorite, sources, screenshots")
        .order("id").range(a, b)),
    fetchAll<DefRow>((a, b) =>
      supabase.from("definitions").select("id, word_id, position, meaning, example")
        .order("id").range(a, b)),
    fetchAll<ExRow>((a, b) =>
      supabase.from("word_examples").select("id, word_id, position, sentence").order("id").range(a, b)),
    fetchAll<LinkRow>((a, b) =>
      supabase.from("word_categories").select("word_id, category_id").order("word_id").range(a, b)),
    fetchAll<CatRow>((a, b) =>
      supabase.from("categories").select("id, name, description").order("id").range(a, b)),
    fetchAll<DiffRow>((a, b) =>
      supabase.from("differences")
        .select("id, title, title_key, items, explanation, examples, extra").order("id").range(a, b)),
  ]);

  const byId = new Map<string, ExistingWord>();
  const state: ExistingState = { words: new Map(), categories: new Map(), differences: new Map() };

  for (const w of words) {
    const ex: ExistingWord = {
      id: w.id, key: w.term_key, term: w.term, wordType: w.word_type ?? "",
      partsOfSpeech: w.parts_of_speech ?? [], notes: w.notes ?? "", priority: w.priority ?? "",
      favorite: !!w.is_favorite, sources: w.sources ?? [], screenshots: w.screenshots ?? [],
      definitions: [], extraExamples: [], categories: [],
    };
    byId.set(w.id, ex);
    state.words.set(w.term_key, ex);
  }
  defs.sort((x, y) => x.position - y.position);
  for (const d of defs) byId.get(d.word_id)?.definitions.push({ meaning: d.meaning, example: d.example ?? "" });
  exs.sort((x, y) => x.position - y.position);
  for (const e of exs) byId.get(e.word_id)?.extraExamples.push(e.sentence);

  const catById = new Map<string, string>();
  for (const c of cats) {
    catById.set(c.id, c.name);
    state.categories.set(c.name.trim().toLowerCase(), { id: c.id, name: c.name, description: c.description ?? "" });
  }
  for (const l of links) {
    const name = catById.get(l.category_id);
    if (name) byId.get(l.word_id)?.categories.push(name);
  }
  for (const d of diffs) {
    state.differences.set(d.title_key, {
      id: d.id, title: d.title, items: d.items ?? [], explanation: d.explanation ?? "",
      examples: d.examples ?? [], extra: d.extra ?? {},
    });
  }
  return state;
}
