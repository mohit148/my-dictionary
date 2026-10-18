"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/words";
import { cn } from "@/lib/utils";

/** Compact star used in word lists. Updates instantly, rolls back if saving fails. */
export function StarToggle({ id, initial, term }: { id: string; initial: boolean; term: string }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button" aria-pressed={on}
      aria-label={on ? `Remove ${term} from favorites` : `Add ${term} to favorites`}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await toggleFavoriteAction(id, next);
          if (!r.ok) setOn(!next); else router.refresh();
        });
      }}
      className="-m-1.5 mt-0 shrink-0 rounded-lg p-1.5 hover:bg-accent-soft"
    >
      <Star className={cn("size-4", on ? "fill-accent text-accent" : "text-muted/50")} aria-hidden />
    </button>
  );
}
