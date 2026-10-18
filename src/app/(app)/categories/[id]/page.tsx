import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryTools } from "@/components/category-tools";
import { SearchBox, WordList } from "@/components/word-list";
import { fetchWordRows } from "@/lib/dictionary/list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Category · My Dictionary" };

export default async function CategoryPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { id } = await params;
  const { q = "", page = "1" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: cat } = await supabase.from("categories").select("id, name, description").eq("id", id).maybeSingle();
  if (!cat) notFound();
  const r = await fetchWordRows(supabase, { q, page: Number.parseInt(page, 10) || 1, categoryId: id });
  return (
    <div>
      <Link href="/categories" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All categories
      </Link>
      <h1 className="text-2xl font-semibold">{cat.name}</h1>
      {cat.description && <p className="mt-1 max-w-2xl text-sm text-muted">{cat.description}</p>}
      <div className="my-5"><CategoryTools id={cat.id} name={cat.name} description={cat.description ?? ""} count={r.total} /></div>
      <SearchBox q={q} />
      <WordList {...r} q={q} basePath={`/categories/${id}`} empty={<p className="font-medium">No words in this category yet.</p>} />
    </div>
  );
}
