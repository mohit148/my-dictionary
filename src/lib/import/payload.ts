import type { PlanWord } from "./types";

/** The JSON shape accepted by the save_word / save_words SQL functions. */
export function toSavePayload(pw: PlanWord, categoryId: (name: string) => string | undefined) {
  const w = pw.word;
  return {
    _mode: pw.action === "add" ? "insert" : "merge",
    term: w.term,
    word_type: w.wordType,
    parts_of_speech: w.partsOfSpeech,
    notes: w.notes,
    is_favorite: w.favorite,
    priority: w.priority,
    sources: w.sources,
    screenshots: w.screenshots,
    extra: w.extra,
    definitions: w.definitions,
    extra_examples: w.extraExamples,
    category_ids: w.categories.map((n) => categoryId(n)).filter((id): id is string => !!id),
  };
}
