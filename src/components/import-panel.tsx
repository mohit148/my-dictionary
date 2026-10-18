"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Upload, X } from "lucide-react";
import { commitImportAction, previewImportAction } from "@/app/actions/import";
import { Button, Card, Chip, Input } from "@/components/ui";
import type { FileFormat, ImportMode, ImportResult, PlanAction, PreviewPlan } from "@/lib/import/types";
import { cn } from "@/lib/utils";

type Picked = { id: string; name: string; text: string; size: number };

const FORMAT_LABEL: Record<FileFormat, string> = {
  "full-dictionary": "Full dictionary",
  "word-list": "List of words",
  "single-word": "Single word",
  differences: "Differences",
  "single-difference": "Single difference",
  unknown: "Unrecognised",
};
const ACTION_TONE = { add: "ok", update: "accent", skip: "neutral" } as const;
const ACTION_LABEL = { add: "Add", update: "Update", skip: "Skip" } as const;
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function ImportPanel() {
  const [files, setFiles] = useState<Picked[]>([]);
  const [mode, setMode] = useState<ImportMode>("add_only");
  const [plan, setPlan] = useState<PreviewPlan | null>(null);
  const [planError, setPlanError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [committing, startCommit] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const req = useRef(0);

  const filesRef = useRef<Picked[]>([]);

  // The preview is read-only and re-runs whenever the files or the mode change.
  function runPreview(nextFiles: Picked[], nextMode: ImportMode) {
    const id = ++req.current;
    setPlan(null);
    setPlanError("");
    if (!nextFiles.length) { setLoadingPlan(false); return; }
    setLoadingPlan(true);
    previewImportAction({ files: nextFiles.map(({ name, text }) => ({ name, text })), mode: nextMode })
      .then((r) => {
        if (id !== req.current) return;
        if ("error" in r) setPlanError(r.error);
        else setPlan(r.plan);
      })
      .catch(() => { if (id === req.current) setPlanError("The preview could not be generated. Please try again."); })
      .finally(() => { if (id === req.current) setLoadingPlan(false); });
  }
  function updateFiles(next: Picked[]) {
    filesRef.current = next;
    setFiles(next);
    runPreview(next, mode);
  }
  function changeMode(next: ImportMode) {
    setMode(next);
    runPreview(filesRef.current, next);
  }

  async function addFiles(list: FileList | File[]) {
    setNotice("");
    const picked: Picked[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(list)) {
      if (!/\.json$/i.test(f.name) && f.type !== "application/json") { skipped.push(f.name); continue; }
      picked.push({ id: crypto.randomUUID(), name: f.name, text: await f.text(), size: f.size });
    }
    const notes: string[] = [];
    if (skipped.length) notes.push(`Only .json files can be imported. Skipped: ${skipped.join(", ")}.`);
    const cur = filesRef.current;
    const seen = new Set(cur.map((c) => `${c.name}:${c.size}`));
    const fresh = picked.filter((p) => !seen.has(`${p.name}:${p.size}`));
    if (fresh.length < picked.length) notes.push("A file with the same name and size was already added.");
    setNotice(notes.join(" "));
    if (fresh.length) {
      setResult(null);
      updateFiles([...cur, ...fresh]);
    }
  }

  const writes = plan
    ? plan.summary.wordsAdd + plan.summary.wordsUpdate + plan.summary.diffsAdd + plan.summary.diffsUpdate + plan.summary.categoriesAdd
    : 0;

  function commit() {
    startCommit(async () => {
      try {
        setResult(await commitImportAction({ files: files.map(({ name, text }) => ({ name, text })), mode }));
      } catch {
        setResult({
          ok: false, error: "The import was interrupted. Check your dictionary, then run the preview again to see what is left.",
          wordsAdded: 0, wordsUpdated: 0, wordsSkipped: 0, diffsAdded: 0, diffsUpdated: 0, diffsSkipped: 0,
          categoriesAdded: 0, categoriesUpdated: 0, rejected: 0, failed: [],
        });
      }
    });
  }

  if (result) {
    return (
      <ResultView
        result={result}
        onReset={() => { setResult(null); updateFiles([]); }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/50",
        )}
      >
        <Upload className="mx-auto size-6 text-link" aria-hidden />
        <p className="mt-3 font-medium">Drop JSON files here</p>
        <p className="mt-1 text-sm text-muted">
          A full dictionary, a list of words, or a file with just one word. You can add several files at once.
        </p>
        <Button type="button" variant="primary" className="mt-4" onClick={() => input.current?.click()}>Choose files</Button>
        <input
          ref={input} type="file" accept=".json,application/json" multiple className="sr-only" aria-label="Choose JSON files"
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      {notice && <p role="status" className="rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn">{notice}</p>}

      {files.length > 0 && (
        <>
          {/* Mode */}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">When a word is already in your dictionary</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["add_only", "Add new entries only", "Words you already have are left exactly as they are."],
                ["merge", "Merge updates into existing entries", "Missing definitions, examples, categories and notes are added. Nothing you wrote is overwritten."],
              ] as const).map(([value, title, desc]) => (
                <label key={value} className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                  mode === value ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/40",
                )}>
                  <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => changeMode(value)} className="sr-only" />
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted">{desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Files */}
          <section aria-label="Selected files">
            <h2 className="mb-2 text-sm font-semibold">Files</h2>
            <ul className="space-y-2">
              {files.map((f) => {
                const info = plan?.files.find((x) => x.name === f.name);
                return (
                  <li key={f.id}>
                    <Card className="flex items-start gap-3 p-3">
                      <FileJson className="mt-0.5 size-5 shrink-0 text-link" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name} <span className="font-normal text-muted">· {kb(f.size)}</span></p>
                        {info && !info.fatal && (
                          <p className="mt-0.5 text-sm text-muted">
                            {FORMAT_LABEL[info.format]} · {plural(info.words, "word")}
                            {info.differences ? `, ${plural(info.differences, "comparison")}` : ""}
                            {info.rejected ? `, ${info.rejected} can’t be imported` : ""}
                          </p>
                        )}
                        {info?.fatal && (
                          <p role="alert" className="mt-1 flex gap-1.5 text-sm text-danger">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>This file can’t be imported. {info.fatal}</span>
                          </p>
                        )}
                        {info?.warnings.length ? (
                          <details className="mt-1 text-sm text-warn">
                            <summary className="cursor-pointer">{plural(info.warnings.length, "note")}</summary>
                            <ul className="mt-1 list-disc pl-5">{info.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}</ul>
                          </details>
                        ) : null}
                      </div>
                      <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${f.name}`}
                        onClick={() => updateFiles(filesRef.current.filter((x) => x.id !== f.id))}>
                        <X className="size-4" />
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>

          {loadingPlan && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your files against your dictionary…
            </p>
          )}
          {planError && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{planError}</p>}

          {plan && !loadingPlan && (
            <>
              <PlanPreview plan={plan} />
              <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-sm backdrop-blur">
                <p className="flex-1 text-sm text-muted">
                  {writes
                    ? "Nothing is saved until you press Import."
                    : "There is nothing new to import from these files."}
                </p>
                <Button type="button" variant="primary" disabled={!writes || committing} onClick={commit}>
                  {committing ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : `Import ${plural(plan.summary.wordsAdd + plan.summary.wordsUpdate, "word")}${plan.summary.diffsAdd + plan.summary.diffsUpdate ? ` and ${plural(plan.summary.diffsAdd + plan.summary.diffsUpdate, "comparison")}` : ""}`}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ preview

function PlanPreview({ plan }: { plan: PreviewPlan }) {
  const s = plan.summary;
  const [tab, setTab] = useState<"words" | "differences" | "categories" | "rejected">("words");
  const [filter, setFilter] = useState<PlanAction | "all">("all");
  const [q, setQ] = useState("");
  // The visible-row limit resets whenever the tab, filter or search changes.
  const sig = `${tab}|${filter}|${q}`;
  const [shown, setShown] = useState({ sig, n: 100 });
  const limit = shown.sig === sig ? shown.n : 100;
  const setLimit = (fn: (l: number) => number) => setShown({ sig, n: fn(limit) });

  const needle = q.trim().toLowerCase();
  const words = useMemo(() => plan.words.filter((w) => (filter === "all" || w.action === filter) && (!needle || w.term.toLowerCase().includes(needle))), [plan, filter, needle]);
  const diffs = useMemo(() => plan.differences.filter((d) => (filter === "all" || d.action === filter) && (!needle || d.title.toLowerCase().includes(needle))), [plan, filter, needle]);
  const cats = plan.categories.filter((c) => (filter === "all" || c.action === filter) && (!needle || c.name.toLowerCase().includes(needle)));

  const tiles: [string, number, string][] = [
    ["To add", s.wordsAdd, "text-ok"], ["To update", s.wordsUpdate, "text-link"],
    ["Skipped", s.wordsSkip, "text-muted"], ["Rejected", s.rejected, s.rejected ? "text-danger" : "text-muted"],
  ];
  const tabs = [
    ["words", "Words", plan.words.length], ["differences", "Differences", plan.differences.length],
    ["categories", "Categories", plan.categories.length], ["rejected", "Rejected", plan.rejected.length],
  ] as const;

  return (
    <section aria-label="Import preview" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Preview</h2>
        <p className="mt-1 text-sm text-muted">
          {plan.mode === "add_only"
            ? `${plural(s.wordsAdd, "new word")} will be added. ${s.wordsSkip ? `${plural(s.wordsSkip, "word")} already in your dictionary will be left untouched. ` : ""}`
            : `${plural(s.wordsAdd, "new word")} will be added and ${plural(s.wordsUpdate, "existing word")} will receive new information. `}
          {s.diffsAdd + s.diffsUpdate > 0 && `${plural(s.diffsAdd + s.diffsUpdate, "comparison")} ${s.diffsUpdate ? "added or updated" : "added"}. `}
          {s.categoriesAdd > 0 && `${plural(s.categoriesAdd, "new category", "new categories")} will be created. `}
          {s.duplicatesCombined > 0 && `${plural(s.duplicatesCombined, "duplicate")} across your files ${s.duplicatesCombined === 1 ? "was" : "were"} combined into single entries.`}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, n, tone]) => (
          <Card key={label} className="p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={cn("mt-1 text-2xl font-semibold", tone)}>{n.toLocaleString()}</dd>
          </Card>
        ))}
      </dl>

      <div role="tablist" aria-label="Preview sections" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === key ? "border-accent-strong font-medium text-link" : "border-transparent text-muted hover:text-foreground")}>
            {label} <span className="text-xs">{n}</span>
          </button>
        ))}
      </div>

      {tab !== "rejected" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Search the preview" className="max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {(["all", "add", "update", "skip"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={cn("rounded-full px-3 py-1 text-sm transition-colors",
                filter === f ? "bg-accent-soft font-medium text-link" : "text-muted hover:bg-accent-soft/60")}>
              {f === "all" ? "All" : ACTION_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel">
        {tab === "words" && (
          <List total={words.length} limit={limit} onMore={() => setLimit((l) => l + 200)} empty="No words match.">
            {words.slice(0, limit).map((w) => (
              <Row key={w.key} title={w.term} action={w.action} reason={w.reason} changes={w.changes} kept={w.kept}
                combined={w.combined} meta={[w.wordType, ...w.categories].filter(Boolean).join(" · ")} sub={w.firstMeaning} />
            ))}
          </List>
        )}
        {tab === "differences" && (
          <List total={diffs.length} limit={limit} onMore={() => setLimit((l) => l + 200)} empty="No comparisons in these files.">
            {diffs.slice(0, limit).map((d) => (
              <Row key={d.key} title={d.title} action={d.action} reason={d.reason} changes={d.changes} kept={d.kept}
                combined={d.combined} meta="" sub={d.explanation} />
            ))}
          </List>
        )}
        {tab === "categories" && (
          <List total={cats.length} limit={limit} onMore={() => {}} empty="No categories in these files.">
            {cats.map((c) => (
              <Row key={c.name} title={c.name} action={c.action}
                reason={c.action === "add" ? "New category" : c.action === "update" ? "Description will be filled in" : "Already exists"}
                changes={[]} kept={[]} combined={[]} meta="" sub={c.description} />
            ))}
          </List>
        )}
        {tab === "rejected" && (
          <List total={plan.rejected.length} limit={limit} onMore={() => setLimit((l) => l + 200)} empty="Nothing was rejected.">
            {plan.rejected.slice(0, limit).map((r, i) => (
              <li key={i} className="border-b border-border px-4 py-3 last:border-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-sm text-danger">{r.reason}</p>
                <p className="text-xs text-muted">{r.file} · {r.where}</p>
              </li>
            ))}
          </List>
        )}
      </div>
    </section>
  );
}

function List({ children, total, limit, onMore, empty }: {
  children: React.ReactNode; total: number; limit: number; onMore: () => void; empty: string;
}) {
  if (!total) return <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">{children}</ul>
      {total > limit && (
        <div className="mt-3 text-center">
          <Button type="button" size="sm" onClick={onMore}>Show more ({(total - limit).toLocaleString()} left)</Button>
        </div>
      )}
    </>
  );
}

function Row({ title, action, reason, changes, kept, combined, meta, sub }: {
  title: string; action: PlanAction; reason: string; changes: string[]; kept: string[]; combined: string[]; meta: string; sub: string;
}) {
  return (
    <li className="border-b border-border px-4 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <Chip tone={ACTION_TONE[action]} className="mt-0.5 w-16 justify-center">{ACTION_LABEL[action]}</Chip>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title} {meta && <span className="ml-1 text-xs font-normal text-muted">{meta}</span>}</p>
          {sub && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{sub}</p>}
          <p className="mt-0.5 text-xs text-muted">{reason}</p>
          {changes.length > 0 && <p className="mt-1 text-xs text-link">Will add: {changes.join(" · ")}</p>}
          {kept.length > 0 && <p className="mt-1 text-xs text-warn">Keeping yours: {kept.join(" · ")}</p>}
          {combined.map((c, i) => <p key={i} className="mt-1 text-xs text-warn">{c}</p>)}
        </div>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------- result

function ResultView({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const rows: [string, number][] = [
    ["Words added", result.wordsAdded], ["Words updated", result.wordsUpdated],
    ["Words skipped", result.wordsSkipped], ["Comparisons added", result.diffsAdded],
    ["Comparisons updated", result.diffsUpdated], ["Comparisons skipped", result.diffsSkipped],
    ["Categories created", result.categoriesAdded], ["Entries rejected", result.rejected],
  ];
  const nothing = rows.every(([, n]) => n === 0) && result.ok;
  return (
    <div className="space-y-6" aria-live="polite">
      <div className={cn("flex items-start gap-3 rounded-2xl p-5", result.ok ? "bg-ok-soft" : "bg-warn-soft")}>
        {result.ok ? <CheckCircle2 className="mt-0.5 size-5 text-ok" aria-hidden /> : <AlertTriangle className="mt-0.5 size-5 text-warn" aria-hidden />}
        <div>
          <h2 className="font-semibold">{result.ok ? (nothing ? "Nothing to import" : "Import complete") : "Import finished with problems"}</h2>
          {result.error && <p className="mt-1 text-sm">{result.error}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(([label, n]) => (
          <Card key={label} className="p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{n.toLocaleString()}</dd>
          </Card>
        ))}
      </dl>
      {result.failed.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-danger">Not saved</h3>
          <ul className="space-y-1 text-sm">
            {result.failed.slice(0, 50).map((f, i) => <li key={i}><span className="font-medium">{f.what}</span> — {f.error}</li>)}
          </ul>
          {result.failed.length > 50 && <p className="mt-2 text-xs text-muted">…and {result.failed.length - 50} more.</p>}
          <p className="mt-3 text-xs text-muted">Run the same files again with “Add new entries only” to retry just these.</p>
        </Card>
      )}
      <div className="flex gap-3">
        <Link href="/dictionary" className="inline-flex h-10 items-center rounded-xl bg-accent-strong px-4 text-sm font-medium text-on-accent hover:brightness-110">
          Open dictionary
        </Link>
        <Button type="button" onClick={onReset}>Import more files</Button>
      </div>
    </div>
  );
}
