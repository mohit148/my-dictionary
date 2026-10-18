import Link from "next/link";
import { SearchBox, WordList } from "@/components/word-list";
import { fetchWordRows } from "@/lib/dictionary/list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Favorites · My Dictionary" };

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "1" } = await searchParams;
  const supabase = await createClient();
  const r = await fetchWordRows(supabase, { q, page: Number.parseInt(page, 10) || 1, favorite: true });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Favorites</h1>
      <SearchBox q={q} />
      <WordList {...r} q={q} basePath="/favorites" empty={
        <>
          <p className="font-medium">No favorites yet.</p>
          <p className="mt-1 text-sm text-muted">Open a word in the <Link className="font-medium text-link underline" href="/dictionary">dictionary</Link> and tap “Add to favorites”.</p>
        </>
      } />
    </div>
  );
}
