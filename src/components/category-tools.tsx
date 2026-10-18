"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/app/actions/words";
import { Button, FieldError, Input, Textarea } from "@/components/ui";

export function NewCategory() {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="mb-8"
      onSubmit={(e) => {
        e.preventDefault();
        setErr("");
        start(async () => {
          const r = await createCategoryAction(name);
          if (!r.ok) return setErr(r.error);
          if (r.existed) return setErr(`“${r.category.name}” already exists.`);
          setName("");
          router.refresh();
        });
      }}
    >
      <div className="flex gap-2">
        <Input aria-label="New category name" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}><Plus className="size-4" /> Create</Button>
      </div>
      <FieldError>{err}</FieldError>
    </form>
  );
}

export function CategoryTools({ id, name, description, count }: { id: string; name: string; description: string; count: number }) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [n, setN] = useState(name);
  const [d, setD] = useState(description);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (mode === "idle")
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMode("edit")}><Pencil className="size-4" /> Edit</Button>
        <Button size="sm" variant="danger" onClick={() => setMode("delete")}><Trash2 className="size-4" /> Delete</Button>
      </div>
    );
  if (mode === "delete")
    return (
      <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
        Delete the category “{name}”? Its {count} {count === 1 ? "word stays" : "words stay"} in your dictionary.
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="danger" disabled={pending} onClick={() =>
            start(async () => {
              const r = await deleteCategoryAction(id);
              if (r.ok) router.push("/categories"); else setErr(r.error);
            })}>{pending ? "Deleting…" : "Yes, delete category"}</Button>
          <Button size="sm" onClick={() => setMode("idle")}>Cancel</Button>
        </div>
        {err}
      </div>
    );
  return (
    <form
      className="max-w-md space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErr("");
        start(async () => {
          const r = await renameCategoryAction(id, n, d);
          if (r.ok) { setMode("idle"); router.refresh(); } else setErr(r.error);
        });
      }}
    >
      <Input aria-label="Category name" value={n} onChange={(e) => setN(e.target.value)} />
      <Textarea aria-label="Description" rows={2} value={d} placeholder="Description (optional)" onChange={(e) => setD(e.target.value)} />
      <FieldError>{err}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" onClick={() => { setMode("idle"); setN(name); setD(description); setErr(""); }}>Cancel</Button>
      </div>
    </form>
  );
}
