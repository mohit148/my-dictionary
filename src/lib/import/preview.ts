import type { ImportPlan, PreviewPlan } from "./types";

function omitUpdate(d: ImportPlan["differences"][number]) {
  const { difference: _difference, update: _update, ...rest } = d;
  void _difference;
  void _update;
  return rest;
}

/** Drops the heavy payloads; the server recomputes the full plan on commit. */
export function toPreview(plan: ImportPlan): PreviewPlan {
  return {
    ...plan,
    words: plan.words.map(({ word, ...rest }) => ({
      ...rest,
      wordType: word.wordType,
      firstMeaning: word.definitions[0]?.meaning ?? "",
      categories: word.categories,
    })),
    differences: plan.differences.map((d) => ({
      ...omitUpdate(d),
      items: d.difference.items,
      explanation: d.difference.explanation,
    })),
  };
}
