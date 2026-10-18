"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadExistingState } from "@/lib/dictionary/existing";
import { buildImportPlan } from "@/lib/import/diff";
import { parseVocabularyFile } from "@/lib/import/parse";
import { toSavePayload } from "@/lib/import/payload";
import { toPreview } from "@/lib/import/preview";
import { requireUser } from "@/lib/supabase/server";
import type { ImportPlan, ImportResult, PreviewPlan } from "@/lib/import/types";

const MAX_FILE_CHARS = 12_000_000;
const inputSchema = z.object({
  files: z.array(z.object({ name: z.string().max(300), text: z.string().max(MAX_FILE_CHARS) })).min(1).max(25),
  mode: z.enum(["add_only", "merge"]),
});

async function plan(raw: unknown) {
  const input = inputSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: "The upload could not be read. Please choose the files again." } as const;
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." } as const;
  const parsed = input.data.files.map((f) => parseVocabularyFile(f.name, f.text));
  let existing;
  try {
    existing = await loadExistingState(supabase);
  } catch {
    return { ok: false, error: "Your dictionary could not be loaded to compare against. Please try again." } as const;
  }
  return { ok: true, supabase, plan: buildImportPlan(parsed, existing, input.data.mode) } as const;
}

/** Validates and compares only; writes nothing. */
export async function previewImportAction(raw: unknown): Promise<{ plan: PreviewPlan } | { error: string }> {
  const r = await plan(raw);
  if (!r.ok) return { error: r.error };
  return { plan: toPreview(r.plan) };
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

const empty = (error?: string): ImportResult => ({
  ok: !error, error, wordsAdded: 0, wordsUpdated: 0, wordsSkipped: 0, diffsAdded: 0, diffsUpdated: 0,
  diffsSkipped: 0, categoriesAdded: 0, categoriesUpdated: 0, rejected: 0, failed: [],
});

/** Recomputes the plan from the raw files and live data, then applies it. */
export async function commitImportAction(raw: unknown): Promise<ImportResult> {
  const r = await plan(raw);
  if (!r.ok) return empty(r.error);
  const { supabase, plan: p } = r;
  const res = empty();
  res.rejected = p.rejected.length;
  res.wordsSkipped = p.summary.wordsSkip;
  res.diffsSkipped = p.summary.diffsSkip;

  const usable = p.words.filter((w) => w.action !== "skip").length + p.differences.filter((d) => d.action !== "skip").length +
    p.categories.filter((c) => c.action !== "skip").length;
  if (!usable) return res; // nothing to write; summary explains why

  // 1) categories (words reference them by id)
  for (const c of chunk(p.categories.filter((c) => c.action === "add"), 100)) {
    const { error } = await supabase.from("categories").insert(c.map((x) => ({ name: x.name, description: x.description })));
    if (error) res.failed.push({ what: `Categories (${c.map((x) => x.name).join(", ").slice(0, 80)})`, error: error.message });
    else res.categoriesAdded += c.length;
  }
  for (const c of p.categories.filter((c) => c.action === "update")) {
    const { error } = await supabase.from("categories").update({ description: c.description })
      .ilike("name", c.name.replace(/[%_\\]/g, "\\$&")).eq("description", "");
    if (error) res.failed.push({ what: `Category "${c.name}"`, error: error.message });
    else res.categoriesUpdated++;
  }
  const { data: catRows, error: catErr } = await supabase.from("categories").select("id, name");
  if (catErr) return { ...res, ok: false, error: "Categories could not be read back, so words were not imported. Nothing else was changed." };
  const catId = new Map((catRows ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]));

  // 2) words, in batches; each word is its own sub-transaction in SQL
  const todo = p.words.filter((w) => w.action !== "skip");
  for (const batch of chunk(todo, 60)) {
    const items = batch.map((pw) => toSavePayload(pw, (n) => catId.get(n.trim().toLowerCase())));
    const { data, error } = await supabase.rpc("save_words", { items });
    if (error) {
      batch.forEach((b) => res.failed.push({ what: b.term, error: error.message }));
      continue;
    }
    const out = data as { saved: number; failed: { term: string; error: string }[] };
    const failedTerms = new Set(out.failed.map((f) => f.term));
    out.failed.forEach((f) => res.failed.push({ what: f.term, error: f.error }));
    for (const b of batch) {
      if (failedTerms.has(b.term)) continue;
      if (b.action === "add") res.wordsAdded++;
      else res.wordsUpdated++;
    }
  }

  // 3) Differences
  const addDiffs = p.differences.filter((d) => d.action === "add");
  for (const batch of chunk(addDiffs, 100)) {
    const { error } = await supabase.from("differences").insert(batch.map((d) => ({
      title: d.difference.title, items: d.difference.items, explanation: d.difference.explanation,
      examples: d.difference.examples, origin: d.difference.origin, extra: d.difference.extra,
    })));
    if (error) batch.forEach((d) => res.failed.push({ what: `Difference "${d.title}"`, error: error.message }));
    else res.diffsAdded += batch.length;
  }
  for (const d of p.differences.filter((d) => d.action === "update" && d.update)) {
    const u = d.update!;
    const { error } = await supabase.from("differences")
      .update({ explanation: u.explanation, examples: u.examples, extra: u.extra }).eq("id", u.id);
    if (error) res.failed.push({ what: `Difference "${d.title}"`, error: error.message });
    else res.diffsUpdated++;
  }

  res.ok = res.failed.length === 0;
  if (!res.ok) res.error = `${res.failed.length} item(s) could not be saved. Everything else was imported.`;
  ["/", "/dictionary", "/favorites", "/categories", "/differences", "/import-export"].forEach((x) => revalidatePath(x));
  return res;
}

export type { ImportPlan };
