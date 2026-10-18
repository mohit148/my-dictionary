import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { SearchBox, WordList } from "@/components/word-list";
import { fetchWordRows } from "@/lib/dictionary/list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dictionary · My Dictionary" };

type SP = { q?: string; page?: string; added?: string; sort?: string; cat?: string; fav?: string };

export default async function DictionaryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q = "", page = "1", added, sort = "az", cat = "", fav = "" } = await searchParams;
  const supabase = await createClient();
  const categoryId = /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined;
  const [r, { data: cats }] = await Promise.all([
    fetchWordRows(supabase, { q, page: Number.parseInt(page, 10) || 1, sort, favorite: fav === "1", categoryId }),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  const keep: Record<string, string> = {
    ...(sort !== "az" ? { sort } : {}), ...(categoryId ? { cat: categoryId } : {}), ...(fav === "1" ? { fav: "1" } : {}),
  };
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dictionary</h1>
        <Link href="/dictionary/new" className="hidden h-10 items-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-medium text-on-accent hover:brightness-110 sm:inline-flex">
          <Plus className="size-4" aria-hidden /> Add Word
        </Link>
      </div>
      {added && <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">Saved “{added}”.</p>}
      <SearchBox q={q} extra={keep} />
      <Suspense fallback={null}><FilterBar categories={cats ?? []} /></Suspense>
      <WordList {...r} q={q} basePath="/dictionary" keep={keep} empty={
        Object.keys(keep).length ? (
          <p className="font-medium">No words match these filters.</p>
        ) : (
          <>
            <p className="font-medium">Your dictionary is empty.</p>
            <p className="mt-1 text-sm text-muted">
              <Link className="font-medium text-link underline" href="/dictionary/new">Add a word</Link> or{" "}
              <Link className="font-medium text-link underline" href="/import-export">import your JSON</Link>.
            </p>
          </>
        )
      } />
    </div>
  );
}
