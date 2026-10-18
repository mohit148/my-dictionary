import Link from "next/link";
import { Search } from "lucide-react";
import { StarToggle } from "@/components/star-toggle";
import { Chip } from "@/components/ui";
import type { WordRow } from "@/lib/dictionary/list";

export function SearchBox({ q, extra }: { q: string; extra?: Record<string, string> }) {
  return (
    <form className="relative mb-6">
      <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted" aria-hidden />
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={q} aria-label="Search words" placeholder="Search words…"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm focus:border-accent focus:outline-none" />
    </form>
  );
}

export function WordList({
  rows, total, page, pages, error, q, basePath, empty, keep,
}: {
  rows: WordRow[]; total: number; page: number; pages: number; error: boolean; q: string;
  basePath: string; empty: React.ReactNode; keep?: Record<string, string>;
}) {
  const href = (p: number) => `${basePath}?${new URLSearchParams({ ...(keep ?? {}), ...(q ? { q } : {}), page: String(p) })}`;
  if (error)
    return <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">This list could not be loaded. Please try again.</p>;
  if (!rows.length)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        {q ? <p className="font-medium">No words match your search.</p> : empty}
      </div>
    );
  return (
    <>
      <p className="mb-2 text-sm text-muted">{total.toLocaleString()} {total === 1 ? "word" : "words"}</p>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((w) => {
          const first = [...w.definitions].sort((a, b) => a.position - b.position)[0]?.meaning ?? "";
          const cats = w.word_categories.map((c) => c.categories?.name).filter(Boolean) as string[];
          return (
            <li key={w.id} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
              <StarToggle key={`${w.id}-${w.is_favorite}`} id={w.id} initial={w.is_favorite} term={w.term} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <Link href={`/dictionary/${w.id}`} className="hover:text-link hover:underline">{w.term}</Link>{" "}
                  {w.word_type && <span className="ml-1 text-xs font-normal text-muted">{w.word_type}</span>}
                </p>
                {first && <p className="line-clamp-1 text-sm text-muted">{first}</p>}
                {cats.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{cats.map((c) => <Chip key={c}>{c}</Chip>)}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link className="text-link underline" href={href(page - 1)}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="text-link underline" href={href(page + 1)}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
