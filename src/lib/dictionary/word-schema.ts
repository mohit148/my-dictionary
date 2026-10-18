import { z } from "zod";
import { collapse } from "@/lib/import/parse";

/** Shape of the Add Word form, shared by the browser form and the server action. */
export const wordInputSchema = z.object({
  term: z.string().max(500),
  wordType: z.string().max(80).default(""),
  partsOfSpeech: z.array(z.string().max(60)).max(20).default([]),
  definitions: z.array(z.object({ meaning: z.string().max(5000), example: z.string().max(5000) })).max(50).default([]),
  extraExamples: z.array(z.string().max(5000)).max(100).default([]),
  notes: z.string().max(10000).default(""),
  categoryIds: z.array(z.string().uuid()).max(100).default([]),
  favorite: z.boolean().default(false),
});
export type WordInput = z.infer<typeof wordInputSchema>;

export const emptyWordInput = (): WordInput => ({
  term: "", wordType: "", partsOfSpeech: [],
  definitions: [{ meaning: "", example: "" }], extraExamples: [], notes: "", categoryIds: [], favorite: false,
});

/** Trims everything and drops fully blank rows, so optional fields can stay empty. */
export function cleanWordInput(w: WordInput): WordInput {
  return {
    ...w,
    term: collapse(w.term),
    wordType: collapse(w.wordType),
    partsOfSpeech: w.partsOfSpeech.map(collapse).filter(Boolean),
    definitions: w.definitions
      .map((d) => ({ meaning: d.meaning.trim(), example: d.example.trim() }))
      .filter((d) => d.meaning || d.example),
    extraExamples: w.extraExamples.map((s) => s.trim()).filter(Boolean),
    notes: w.notes.trim(),
  };
}

export type FieldErrors = Record<string, string>;

/** Business rules. Returns {} when the (already cleaned) input is valid. */
export function validateWordInput(w: WordInput): FieldErrors {
  const e: FieldErrors = {};
  if (!w.term) e.term = "Enter the word or expression you want to save.";
  else if (w.term.length > 200) e.term = "That's quite long — keep it under 200 characters.";
  w.definitions.forEach((d, i) => {
    if (!d.meaning) e[`definitions.${i}.meaning`] = "Add a definition for this example, or remove the example.";
  });
  return e;
}
