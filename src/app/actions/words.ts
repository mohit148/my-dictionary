"use server";

import { revalidatePath } from "next/cache";
import { keyOf, collapse } from "@/lib/import/parse";
import { requireUser } from "@/lib/supabase/server";
import { cleanWordInput, validateWordInput, wordInputSchema, type FieldErrors } from "@/lib/dictionary/word-schema";

export type CreateWordResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; existingId?: string };

export async function createWordAction(raw: unknown): Promise<CreateWordResult> {
  const parsed = wordInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some of the form data was not valid. Please check it and try again." };

  const input = cleanWordInput(parsed.data);
  const fieldErrors = validateWordInput(input);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };

  const { data: dup, error: dupErr } = await supabase
    .from("words").select("id, term").eq("term_key", keyOf(input.term)).maybeSingle();
  if (dupErr) return { ok: false, error: "Could not check for duplicates. Please try again." };
  if (dup) {
    return {
      ok: false, existingId: dup.id,
      error: `"${dup.term}" is already in your dictionary.`,
      fieldErrors: { term: `"${dup.term}" is already in your dictionary.` },
    };
  }

  if (input.categoryIds.length) {
    const { data: owned } = await supabase.from("categories").select("id").in("id", input.categoryIds);
    if ((owned?.length ?? 0) !== new Set(input.categoryIds).size)
      return { ok: false, error: "One of the selected categories no longer exists. Please reselect." };
  }

  const { data, error } = await supabase.rpc("save_word", {
    p: {
      term: input.term,
      word_type: input.wordType,
      parts_of_speech: input.partsOfSpeech,
      notes: input.notes,
      is_favorite: input.favorite,
      definitions: input.definitions,
      extra_examples: input.extraExamples,
      category_ids: input.categoryIds,
    },
    p_mode: "insert",
  });
  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate_word"))
      return { ok: false, error: `"${input.term}" is already in your dictionary.`, fieldErrors: { term: "Already in your dictionary." } };
    return { ok: false, error: "The word could not be saved. Nothing was changed — please try again." };
  }

  revalidatePath("/dictionary");
  revalidatePath("/favorites");
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true, id: data as string };
}

export async function checkDuplicateAction(term: string): Promise<{ exists: boolean; id?: string; term?: string }> {
  const t = collapse(String(term ?? ""));
  if (!t) return { exists: false };
  const { supabase, user } = await requireUser();
  if (!user) return { exists: false };
  const { data } = await supabase.from("words").select("id, term").eq("term_key", keyOf(t)).maybeSingle();
  return data ? { exists: true, id: data.id, term: data.term } : { exists: false };
}

export type CreateCategoryResult =
  | { ok: true; category: { id: string; name: string }; existed: boolean }
  | { ok: false; error: string };

export async function createCategoryAction(name: string): Promise<CreateCategoryResult> {
  const n = collapse(String(name ?? ""));
  if (!n) return { ok: false, error: "Enter a category name." };
  if (n.length > 60) return { ok: false, error: "Category names can be up to 60 characters." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };

  const { data: found } = await supabase.from("categories").select("id, name").ilike("name", n.replace(/[%_\\]/g, "\\$&"));
  const same = found?.find((c) => c.name.trim().toLowerCase() === n.toLowerCase());
  if (same) return { ok: true, category: same, existed: true };

  const { data, error } = await supabase.from("categories").insert({ name: n }).select("id, name").single();
  if (error || !data) return { ok: false, error: "The category could not be created. Please try again." };
  revalidatePath("/categories");
  return { ok: true, category: data, existed: false };
}

export type SimpleResult = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function updateWordAction(id: string, raw: unknown): Promise<SimpleResult> {
  const parsed = wordInputSchema.safeParse(raw);
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Some of the form data was not valid." };
  const input = cleanWordInput(parsed.data);
  const fieldErrors = validateWordInput(input);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };

  const { error } = await supabase.rpc("update_word", {
    p_id: id,
    p: {
      term: input.term, word_type: input.wordType, parts_of_speech: input.partsOfSpeech, notes: input.notes,
      is_favorite: input.favorite, definitions: input.definitions, extra_examples: input.extraExamples,
      category_ids: input.categoryIds,
    },
  });
  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate_word"))
      return { ok: false, error: `"${input.term}" is already in your dictionary.`, fieldErrors: { term: "Already in your dictionary." } };
    if (error.message.includes("unknown category")) return { ok: false, error: "One of the selected categories no longer exists. Please reselect." };
    return { ok: false, error: "The changes could not be saved. Nothing was changed — please try again." };
  }
  for (const p of ["/dictionary", `/dictionary/${id}`, "/favorites", "/categories", "/"]) revalidatePath(p);
  return { ok: true };
}

export async function toggleFavoriteAction(id: string, value: boolean): Promise<SimpleResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await supabase.from("words").update({ is_favorite: value }).eq("id", id);
  if (error) return { ok: false, error: "Could not update favorite." };
  for (const p of ["/dictionary", `/dictionary/${id}`, "/favorites", "/"]) revalidatePath(p);
  return { ok: true };
}

export async function deleteWordAction(id: string): Promise<SimpleResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await supabase.from("words").delete().eq("id", id);
  if (error) return { ok: false, error: "The word could not be deleted." };
  for (const p of ["/dictionary", "/favorites", "/categories", "/"]) revalidatePath(p);
  return { ok: true };
}

export async function renameCategoryAction(id: string, name: string, description: string): Promise<SimpleResult> {
  const n = collapse(String(name ?? ""));
  if (!n) return { ok: false, error: "Enter a category name." };
  if (n.length > 60) return { ok: false, error: "Category names can be up to 60 characters." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await supabase.from("categories").update({ name: n, description: String(description ?? "").trim().slice(0, 500) }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: `You already have a category called “${n}”.` };
    return { ok: false, error: "The category could not be saved." };
  }
  for (const p of ["/categories", `/categories/${id}`, "/dictionary"]) revalidatePath(p);
  return { ok: true };
}

/** Removes the category only; its words stay in the dictionary. */
export async function deleteCategoryAction(id: string): Promise<SimpleResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: "The category could not be deleted." };
  for (const p of ["/categories", "/dictionary"]) revalidatePath(p);
  return { ok: true };
}
