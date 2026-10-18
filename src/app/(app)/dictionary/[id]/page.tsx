import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { DeleteButton, FavoriteButton } from "@/components/word-actions";
import { Chip } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Word · My Dictionary" };

export default async function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: w } = await supabase
    .from("words")
    .select(`id, term, word_type, parts_of_speech, notes, is_favorite, priority, sources, screenshots,
             definitions(position, meaning, example), word_examples(position, sentence),
             word_categories(categories(id, name))`)
    .eq("id", id).maybeSingle();
  if (!w) notFound();

  const defs = [...w.definitions].sort((a, b) => a.position - b.position);
  const exs = [...w.word_examples].sort((a, b) => a.position - b.position);
  const cats = w.word_categories.map((c) => c.categories).flat().filter(Boolean) as { id: string; name: string }[];

  return (
    <div className="max-w-2xl">
      <Link href="/dictionary" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to dictionary
      </Link>
      <h1 className="text-3xl font-semibold">{w.term}</h1>
      <p className="mt-1 text-sm text-muted">
        {[w.word_type, ...(w.parts_of_speech ?? [])].filter(Boolean).join(" · ")}
        {w.priority ? ` · ${w.priority}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FavoriteButton id={w.id} initial={w.is_favorite} />
        <Link href={`/dictionary/${w.id}/edit`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm hover:bg-accent-soft/60">
          <Pencil className="size-4" aria-hidden /> Edit
        </Link>
        <DeleteButton id={w.id} term={w.term} />
      </div>

      {cats.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{cats.map((c) => <Chip key={c.id}>{c.name}</Chip>)}</div>}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Definitions</h2>
        {defs.length ? (
          <ol className="space-y-4">
            {defs.map((d, i) => (
              <li key={i} className="rounded-2xl border border-border bg-surface p-4">
                <p>{defs.length > 1 && <span className="mr-2 text-muted">{i + 1}.</span>}{d.meaning}</p>
                {d.example && <p className="mt-2 text-sm italic text-muted">“{d.example}”</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No definition yet. <Link className="underline" href={`/dictionary/${w.id}/edit`}>Add one</Link>.</p>
        )}
      </section>

      {exs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">More examples</h2>
          <ul className="space-y-2 text-sm italic text-muted">{exs.map((e, i) => <li key={i}>“{e.sentence}”</li>)}</ul>
        </section>
      )}

      {w.notes && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{w.notes}</p>
        </section>
      )}

      {((w.sources?.length ?? 0) > 0 || (w.screenshots?.length ?? 0) > 0) && (
        <section className="mt-8 text-xs text-muted">
          {w.sources?.length > 0 && <p>Source: {w.sources.join(", ")}</p>}
          {w.screenshots?.length > 0 && <p>Screenshots: {w.screenshots.join(", ")}</p>}
        </section>
      )}
    </div>
  );
}
