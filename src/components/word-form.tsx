"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Star, Trash2, X } from "lucide-react";
import { checkDuplicateAction, createCategoryAction, createWordAction, updateWordAction } from "@/app/actions/words";
import { Button, Card, Chip, FieldError, Input, Label, Textarea } from "@/components/ui";
import {
  cleanWordInput, emptyWordInput, validateWordInput, type FieldErrors, type WordInput,
} from "@/lib/dictionary/word-schema";
import { cn } from "@/lib/utils";

type Cat = { id: string; name: string };
const TYPE_SUGGESTIONS = ["word", "phrase", "idiom", "expression", "slang", "phrasal verb", "grammar"];

export function WordForm({
  categories: initialCategories, wordId, initial,
}: { categories: Cat[]; wordId?: string; initial?: WordInput }) {
  const editing = !!wordId;
  const router = useRouter();
  const [form, setForm] = useState<WordInput>(() => initial ?? emptyWordInput());
  const [pos, setPos] = useState(() => (initial?.partsOfSpeech ?? []).join(", "));
  const [cats, setCats] = useState<Cat[]>(initialCategories);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ tone: "error" | "ok"; text: string; href?: string } | null>(null);
  const [dup, setDup] = useState<{ id: string; term: string } | null>(null);
  const [pending, start] = useTransition();
  const termRef = useRef<HTMLInputElement>(null);
  const termErrId = useId();

  const set = <K extends keyof WordInput>(k: K, v: WordInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDef = (i: number, patch: Partial<WordInput["definitions"][number]>) =>
    set("definitions", form.definitions.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const moveDef = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.definitions.length) return;
    const next = [...form.definitions];
    [next[i], next[j]] = [next[j], next[i]];
    set("definitions", next);
  };

  // Live duplicate hint (the server re-checks on save).
  useEffect(() => {
    const t = form.term.trim();
    if (!t) return;
    const h = setTimeout(async () => {
      const r = await checkDuplicateAction(t);
      setDup(r.exists && r.id !== wordId ? { id: r.id!, term: r.term! } : null);
    }, 350);
    return () => clearTimeout(h);
  }, [form.term, wordId]);

  function submit(andAnother: boolean) {
    setBanner(null);
    const payload = cleanWordInput({ ...form, partsOfSpeech: pos.split(",") });
    const local = validateWordInput(payload);
    if (Object.keys(local).length) {
      setErrors(local);
      setBanner({ tone: "error", text: "Please fix the highlighted fields." });
      if (local.term) termRef.current?.focus();
      return;
    }
    setErrors({});
    start(async () => {
      if (wordId) {
        const u = await updateWordAction(wordId, payload);
        if (u.ok) { router.push(`/dictionary/${wordId}`); return; }
        setErrors(u.fieldErrors ?? {});
        setBanner({ tone: "error", text: u.error });
        if (u.fieldErrors?.term) termRef.current?.focus();
        return;
      }
      const r = await createWordAction(payload);
      if (r.ok) {
        if (andAnother) {
          setForm(emptyWordInput());
          setPos("");
          setDup(null);
          setBanner({ tone: "ok", text: `Saved “${payload.term}”. Add the next one.`, href: `/dictionary` });
          termRef.current?.focus();
        } else {
          router.push(`/dictionary?added=${encodeURIComponent(payload.term)}`);
        }
        return;
      }
      setErrors(r.fieldErrors ?? {});
      setBanner({ tone: "error", text: r.error });
      if (r.fieldErrors?.term) termRef.current?.focus();
    });
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(false); }}
      className="space-y-8"
      noValidate
    >
      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl px-4 py-3 text-sm",
            banner.tone === "error" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
          )}
        >
          {banner.text}
          {banner.href && <> <Link className="font-medium underline" href={banner.href}>View dictionary</Link></>}
        </div>
      )}

      {/* Word + type */}
      <section className="space-y-4">
        <div>
          <Label htmlFor="term">Word or expression <span className="text-danger">*</span></Label>
          <Input
            id="term" ref={termRef} value={form.term} autoFocus autoComplete="off"
            placeholder="e.g. serendipity, spill the tea, as a matter of fact"
            onChange={(e) => { set("term", e.target.value); if (!e.target.value.trim()) setDup(null); }}
            aria-invalid={!!errors.term} aria-describedby={errors.term ? termErrId : undefined}
          />
          <FieldError id={termErrId}>{errors.term}</FieldError>
          {dup && !errors.term && (
            <p className="mt-1.5 text-sm text-warn">
              “{dup.term}” is already in your dictionary. {" "}
              <Link className="font-medium underline" href={`/dictionary?q=${encodeURIComponent(dup.term)}`}>Find it</Link>
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="type">Type <span className="font-normal text-muted">(optional)</span></Label>
            <Input
              id="type" list="word-types" value={form.wordType} maxLength={80}
              placeholder="word, idiom, slang… or your own"
              onChange={(e) => set("wordType", e.target.value)}
            />
            <datalist id="word-types">{TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <Label htmlFor="pos">Part of speech <span className="font-normal text-muted">(optional)</span></Label>
            <Input id="pos" value={pos} placeholder="noun, verb" onChange={(e) => setPos(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Definitions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Definitions</h2>
        <div className="space-y-3">
          {form.definitions.map((d, i) => (
            <Card key={i} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Definition {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" aria-label={`Move definition ${i + 1} up`}
                    disabled={i === 0} onClick={() => moveDef(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Move definition ${i + 1} down`}
                    disabled={i === form.definitions.length - 1} onClick={() => moveDef(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button type="button" variant="danger" size="sm" aria-label={`Remove definition ${i + 1}`}
                    onClick={() => set("definitions", form.definitions.length > 1
                      ? form.definitions.filter((_, j) => j !== i) : [{ meaning: "", example: "" }])}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Label htmlFor={`m${i}`} className="sr-only">Meaning {i + 1}</Label>
              <Textarea
                id={`m${i}`} rows={2} value={d.meaning} placeholder="What does it mean?"
                onChange={(e) => setDef(i, { meaning: e.target.value })}
                aria-invalid={!!errors[`definitions.${i}.meaning`]}
              />
              <FieldError>{errors[`definitions.${i}.meaning`]}</FieldError>
              <Label htmlFor={`e${i}`} className="sr-only">Example for definition {i + 1}</Label>
              <Input
                id={`e${i}`} className="mt-2" value={d.example} placeholder="Example sentence (optional)"
                onChange={(e) => setDef(i, { example: e.target.value })}
              />
            </Card>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-3"
          onClick={() => set("definitions", [...form.definitions, { meaning: "", example: "" }])}>
          <Plus className="size-4" /> Add another definition
        </Button>
      </section>

      {/* Extra examples */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">More example sentences <span className="font-normal text-muted">(optional)</span></h2>
        <p className="mb-3 text-sm text-muted">Examples that don’t belong to one particular definition.</p>
        <div className="space-y-2">
          {form.extraExamples.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Example sentence ${i + 1}`} value={s}
                onChange={(e) => set("extraExamples", form.extraExamples.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button type="button" variant="danger" aria-label={`Remove example ${i + 1}`}
                onClick={() => set("extraExamples", form.extraExamples.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2"
          onClick={() => set("extraExamples", [...form.extraExamples, ""])}>
          <Plus className="size-4" /> Add example
        </Button>
      </section>

      <section>
        <Label htmlFor="notes">Personal notes <span className="font-normal text-muted">(optional)</span></Label>
        <Textarea id="notes" rows={3} value={form.notes} placeholder="Where you heard it, how to remember it…"
          onChange={(e) => set("notes", e.target.value)} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Categories <span className="font-normal text-muted">(optional)</span></h2>
        <CategoryPicker
          cats={cats} selected={form.categoryIds}
          onChange={(ids) => set("categoryIds", ids)}
          onCreated={(c) => { setCats((l) => [...l, c].sort((a, b) => a.name.localeCompare(b.name))); }}
        />
      </section>

      <section>
        <button
          type="button" aria-pressed={form.favorite} onClick={() => set("favorite", !form.favorite)}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
            form.favorite ? "border-accent bg-accent-soft text-link" : "border-border bg-surface text-muted hover:bg-accent-soft/60",
          )}
        >
          <Star className={cn("size-4", form.favorite && "fill-current")} aria-hidden />
          {form.favorite ? "In favorites" : "Add to favorites"}
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save word"}</Button>
        {!editing && <Button type="button" disabled={pending} onClick={() => submit(true)}>Save & add another</Button>}
        <Link href={editing ? `/dictionary/${wordId}` : "/dictionary"} className="ml-auto text-sm text-muted hover:text-foreground">Cancel</Link>
      </div>
    </form>
  );
}

function CategoryPicker({
  cats, selected, onChange, onCreated,
}: { cats: Cat[]; selected: string[]; onChange: (ids: string[]) => void; onCreated: (c: Cat) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();

  const chosen = cats.filter((c) => selected.includes(c.id));
  const shown = useMemo(() => cats.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [cats, q]);
  const canCreate = q.trim() && !cats.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  function create() {
    setErr("");
    start(async () => {
      const r = await createCategoryAction(q);
      if (!r.ok) return setErr(r.error);
      if (!r.existed) onCreated(r.category);
      if (!selected.includes(r.category.id)) onChange([...selected, r.category.id]);
      setQ("");
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((c) => (
          <Chip key={c.id}>
            {c.name}
            <button type="button" aria-label={`Remove ${c.name}`} onClick={() => toggle(c.id)} className="rounded-full hover:text-danger">
              <X className="size-3" />
            </button>
          </Chip>
        ))}
        <Button type="button" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Done" : chosen.length ? "Change" : "Choose categories"}
        </Button>
      </div>
      {open && (
        <Card className="mt-3 p-3">
          <Input
            aria-label="Search or create a category" placeholder="Search, or type a new category name"
            value={q} onChange={(e) => { setQ(e.target.value); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canCreate) create(); } }}
          />
          <ul className="mt-2 max-h-52 space-y-0.5 overflow-auto" role="listbox" aria-multiselectable>
            {shown.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id} role="option" aria-selected={on}>
                  <button type="button" onClick={() => toggle(c.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent-soft/60">
                    <span className={cn("grid size-4 place-items-center rounded border", on ? "border-accent-strong bg-accent-strong text-on-accent" : "border-border")}>
                      {on && <Check className="size-3" />}
                    </span>
                    {c.name}
                  </button>
                </li>
              );
            })}
            {!shown.length && !canCreate && <li className="px-2 py-1.5 text-sm text-muted">No categories yet. Type a name to create one.</li>}
          </ul>
          {canCreate && (
            <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={create}>
              <Plus className="size-4" /> Create “{q.trim()}”
            </Button>
          )}
          <FieldError>{err}</FieldError>
        </Card>
      )}
    </div>
  );
}
