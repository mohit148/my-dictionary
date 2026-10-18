"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { deleteWordAction, toggleFavoriteAction } from "@/app/actions/words";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        type="button" aria-pressed={on} disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next); setErr("");
          start(async () => {
            const r = await toggleFavoriteAction(id, next);
            if (!r.ok) { setOn(!next); setErr(r.error); } else router.refresh();
          });
        }}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
          on ? "border-accent bg-accent-soft text-link" : "border-border bg-surface text-muted hover:bg-accent-soft/60",
        )}
      >
        <Star className={cn("size-4", on && "fill-current")} aria-hidden />
        {on ? "Favorite" : "Add to favorites"}
      </button>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </>
  );
}

export function DeleteButton({ id, term }: { id: string; term: string }) {
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!confirming)
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}><Trash2 className="size-4" /> Delete</Button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-3 py-1.5 text-sm text-danger" role="alert">
      Delete “{term}” permanently?
      <Button variant="danger" size="sm" disabled={pending} onClick={() =>
        start(async () => {
          const r = await deleteWordAction(id);
          if (r.ok) router.push("/dictionary"); else setErr(r.error);
        })}>{pending ? "Deleting…" : "Yes, delete"}</Button>
      <Button size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      {err}
    </span>
  );
}
