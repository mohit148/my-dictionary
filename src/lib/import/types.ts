// Shared types for the vocabulary import pipeline.
// The pipeline is pure TypeScript (no DB, no React) so it can be unit-tested
// against the real JSON file and reused on the server.

export type Definition = { meaning: string; example: string };

export type NormalizedWord = {
  term: string;
  key: string; // lower(trim(term)) — must match words.term_key in Postgres
  wordType: string; // JSON "type": word | phrase | idiom | slang | ...
  partsOfSpeech: string[]; // JSON "part_of_speech"
  definitions: Definition[];
  extraExamples: string[]; // examples not attached to a definition
  notes: string;
  sources: string[]; // JSON "source"
  screenshots: string[];
  priority: string;
  favorite: boolean;
  categories: string[]; // category names
  extra: Record<string, unknown>; // every unrecognised field, kept verbatim
};

export type NormalizedDifference = {
  title: string;
  key: string;
  items: string[];
  explanation: string;
  examples: string[];
  origin: string;
  extra: Record<string, unknown>;
};

export type NormalizedCategory = { name: string; key: string; description: string };

export type Rejection = {
  file: string;
  where: string; // e.g. 'categories["slang"][12]'
  label: string; // best-effort name for display
  reason: string;
};

export type FileFormat =
  | "full-dictionary"
  | "word-list"
  | "single-word"
  | "differences"
  | "single-difference"
  | "unknown";

export type ParsedFile = {
  name: string;
  format: FileFormat;
  words: NormalizedWord[];
  differences: NormalizedDifference[];
  categories: NormalizedCategory[];
  rejected: Rejection[];
  warnings: string[];
  fatal?: string; // whole file unusable (bad JSON, unknown structure)
};

// ---- what already lives in the user's database -------------------------

export type ExistingWord = {
  id: string;
  key: string;
  term: string;
  wordType: string;
  partsOfSpeech: string[];
  notes: string;
  priority: string;
  favorite: boolean;
  sources: string[];
  screenshots: string[];
  definitions: Definition[];
  extraExamples: string[];
  categories: string[]; // names
};

export type ExistingCategory = { id: string; name: string; description: string };

export type ExistingDifference = {
  id: string;
  title: string;
  items: string[];
  explanation: string;
  examples: string[];
  extra: Record<string, unknown>;
};

export type ExistingState = {
  words: Map<string, ExistingWord>; // by key
  categories: Map<string, ExistingCategory>; // by lower(trim(name))
  differences: Map<string, ExistingDifference>; // by lower(trim(title))
};

// ---- the plan shown in the preview and applied on commit ---------------

export type ImportMode = "add_only" | "merge";
export type PlanAction = "add" | "update" | "skip";

export type PlanWord = {
  key: string;
  term: string;
  action: PlanAction;
  reason: string; // why this action, in plain language
  changes: string[]; // what an update will add
  kept: string[]; // conflicts where your existing data was kept
  combined: string[]; // notes about duplicates merged across/within files
  files: string[];
  word: NormalizedWord;
};

export type PlanDifference = {
  key: string;
  title: string;
  action: PlanAction;
  reason: string;
  changes: string[];
  kept: string[];
  combined: string[];
  files: string[];
  difference: NormalizedDifference; // incoming (combined) data
  update?: { id: string; explanation: string; examples: string[]; extra: Record<string, unknown> };
};

export type PlanCategory = {
  name: string;
  action: PlanAction; // add = create, update = fill blank description, skip = exists
  description: string;
};

export type ImportPlan = {
  mode: ImportMode;
  files: {
    name: string;
    format: FileFormat;
    words: number;
    differences: number;
    rejected: number;
    warnings: string[];
    fatal?: string;
  }[];
  words: PlanWord[];
  differences: PlanDifference[];
  categories: PlanCategory[];
  rejected: Rejection[];
  summary: {
    wordsAdd: number;
    wordsUpdate: number;
    wordsSkip: number;
    diffsAdd: number;
    diffsUpdate: number;
    diffsSkip: number;
    categoriesAdd: number;
    rejected: number;
    duplicatesCombined: number;
  };
};

// ---- slim version of the plan sent to the browser for the preview ------

export type PreviewWord = Omit<PlanWord, "word"> & {
  wordType: string;
  firstMeaning: string;
  categories: string[];
};
export type PreviewDifference = Omit<PlanDifference, "difference" | "update"> & {
  items: string[];
  explanation: string;
};
export type PreviewPlan = Omit<ImportPlan, "words" | "differences"> & {
  words: PreviewWord[];
  differences: PreviewDifference[];
};

export type ImportResult = {
  ok: boolean;
  error?: string;
  wordsAdded: number;
  wordsUpdated: number;
  wordsSkipped: number;
  diffsAdded: number;
  diffsUpdated: number;
  diffsSkipped: number;
  categoriesAdded: number;
  categoriesUpdated: number;
  rejected: number;
  failed: { what: string; error: string }[];
};
