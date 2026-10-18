import { DeleteDifference } from "@/components/delete-difference";
import { SearchBox } from "@/components/word-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Differences · My Dictionary" };

export default async function DifferencesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("differences").select("id, title, items, explanation, examples").order("title_key").limit(500);
  const t = q.trim().replace(/[%_\\,()]/g, " ").trim();
  if (t) query = query.or(`title.ilike.%${t}%,explanation.ilike.%${t}%`);
  const { data, error } = await query;
  const rows = data ?? [];
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Differences</h1>
      <p className="mb-6 text-sm text-muted">Commonly confused words, side by side. Add more by importing a JSON file with a “Differences” list.</p>
      <SearchBox q={q} />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Differences could not be loaded.</p>}
      {!error && !rows.length && (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted">
          {q ? "No comparisons match your search." : "No differences yet. Import a JSON file that contains them."}
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((d) => (
          <li key={d.id}>
            <details className="group rounded-2xl border border-border bg-surface p-4">
              <summary className="cursor-pointer list-none font-medium">
                {(d.items?.length ? d.items : [d.title]).map((x: string, i: number) => (
                  <span key={i}>{i > 0 && <span className="mx-2 text-sm font-normal text-muted">vs</span>}{x}</span>
                ))}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                {d.explanation && <p>{d.explanation}</p>}
                {d.examples?.length > 0 && <ul className="space-y-1 italic text-muted">{d.examples.map((e: string, i: number) => <li key={i}>“{e}”</li>)}</ul>}
                <DeleteDifference id={d.id} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
