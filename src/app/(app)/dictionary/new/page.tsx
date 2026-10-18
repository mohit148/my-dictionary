import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WordForm } from "@/components/word-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Add word · My Dictionary" };

export default async function NewWordPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name");
  return (
    <div>
      <Link href="/dictionary" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to dictionary
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Add word</h1>
      <p className="mb-8 text-sm text-muted">Words, phrases, idioms and expressions all work. Only the word itself is required.</p>
      <WordForm categories={data ?? []} />
    </div>
  );
}
