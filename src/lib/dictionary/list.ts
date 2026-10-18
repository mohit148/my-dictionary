import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 50;

export type WordRow = {
  id: string; term: string; word_type: string | null; is_favorite: boolean;
  definitions: { meaning: string; position: number }[];
  word_categories: { categories: { name: string } | null }[];
};

export async function fetchWordRows(
  supabase: SupabaseClient,
  o: { q?: string; page?: number; favorite?: boolean; categoryId?: string; sort?: string },
) {
  const page = Math.max(1, o.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const base = "id, term, word_type, is_favorite, definitions(meaning, position), word_categories(categories(name))";
  let query = supabase
    .from("words")
    .select(o.categoryId ? `${base}, cat:word_categories!inner(category_id)` : base, { count: "exact" })
    .range(from, from + PAGE_SIZE - 1);
  if (o.sort === "new") query = query.order("created_at", { ascending: false }).order("term_key");
  else if (o.sort === "old") query = query.order("created_at", { ascending: true }).order("term_key");
  else query = query.order("term_key", { ascending: o.sort !== "za" });
  if (o.favorite) query = query.eq("is_favorite", true);
  if (o.categoryId) query = query.eq("cat.category_id", o.categoryId);
  const term = (o.q ?? "").trim().replace(/[%_\\,()]/g, " ").trim();
  if (term) query = query.or(`term.ilike.%${term}%,notes.ilike.%${term}%`);
  const { data, count, error } = await query;
  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as WordRow[],
    total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), error: !!error,
  };
}
