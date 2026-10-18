import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/dictionary/existing";
import { buildExport, type ExportRows } from "@/lib/export/build";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const [words, definitions, examples, links, categories, differences] = await Promise.all([
      fetchAll<ExportRows["words"][number]>((a, b) =>
        supabase.from("words").select("id, term, word_type, parts_of_speech, notes, is_favorite, priority, sources, screenshots, extra").order("id").range(a, b)),
      fetchAll<ExportRows["definitions"][number]>((a, b) =>
        supabase.from("definitions").select("word_id, position, meaning, example").order("id").range(a, b)),
      fetchAll<ExportRows["examples"][number]>((a, b) =>
        supabase.from("word_examples").select("word_id, position, sentence").order("id").range(a, b)),
      fetchAll<ExportRows["links"][number]>((a, b) =>
        supabase.from("word_categories").select("word_id, category_id").order("word_id").range(a, b)),
      fetchAll<ExportRows["categories"][number]>((a, b) =>
        supabase.from("categories").select("id, name, description").order("id").range(a, b)),
      fetchAll<ExportRows["differences"][number]>((a, b) =>
        supabase.from("differences").select("title, items, explanation, examples, origin, extra").order("id").range(a, b)),
    ]);
    const body = JSON.stringify(buildExport({ words, definitions, examples, links, categories, differences }), null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="my-dictionary-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
