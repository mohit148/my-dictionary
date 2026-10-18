import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WordForm } from "@/components/word-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit word · My Dictionary" };

export default async function EditWordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: w }, { data: cats }] = await Promise.all([
    supabase.from("words")
      .select(`id, term, word_type, parts_of_speech, notes, is_favorite,
               definitions(position, meaning, example), word_examples(position, sentence), word_categories(category_id)`)
      .eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  if (!w) notFound();
  const defs = [...w.definitions].sort((a, b) => a.position - b.position).map((d) => ({ meaning: d.meaning, example: d.example ?? "" }));
  return (
    <div>
      <Link href={`/dictionary/${w.id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to word
      </Link>
      <h1 className="mb-8 text-2xl font-semibold">Edit “{w.term}”</h1>
      <WordForm
        categories={cats ?? []} wordId={w.id}
        initial={{
          term: w.term, wordType: w.word_type ?? "", partsOfSpeech: w.parts_of_speech ?? [],
          definitions: defs.length ? defs : [{ meaning: "", example: "" }],
          extraExamples: [...w.word_examples].sort((a, b) => a.position - b.position).map((e) => e.sentence),
          notes: w.notes ?? "", categoryIds: w.word_categories.map((c) => c.category_id), favorite: w.is_favorite,
        }}
      />
    </div>
  );
}
