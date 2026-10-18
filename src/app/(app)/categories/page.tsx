import Link from "next/link";
import { NewCategory } from "@/components/category-tools";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Categories · My Dictionary" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, word_categories(count)")
    .order("name");
  const cats = (data ?? []).map((c) => ({
    id: c.id as string, name: c.name as string, description: (c.description ?? "") as string,
    count: (c.word_categories as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">My Categories</h1>
      <NewCategory />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Categories could not be loaded.</p>}
      {!error && !cats.length && (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted">
          No categories yet. Create one above, or import your JSON.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/categories/${c.id}`} className="block h-full rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-accent-soft/50">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">{c.count.toLocaleString()} {c.count === 1 ? "word" : "words"}</p>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.description}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
