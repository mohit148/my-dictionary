"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, FolderOpen, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
];

type Option = { value: string; label: string };

/** A small themed dropdown: button + popover list. Closes on outside click, Escape, or selection. */
function Menu({
  icon: Icon, label, value, options, onChange, active, searchable = false, width = "w-60",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; options: Option[]; onChange: (v: string) => void;
  active: boolean; searchable?: boolean; width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        onClick={() => { setOpen((v) => !v); setQ(""); }}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
          active ? "border-accent bg-accent-soft text-link" : "border-border bg-surface text-foreground hover:bg-accent-soft",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="text-muted">{label}</span>
        <span className="max-w-36 truncate font-medium">{current?.label ?? options[0]?.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className={cn("absolute left-0 top-full z-30 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-1.5 shadow-lg", width)}>
          {searchable && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted" aria-hidden />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}
          <ul id={id} role="listbox" aria-label={label} className="max-h-64 overflow-auto">
            {shown.map((o) => {
              const on = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      on ? "bg-accent-soft font-medium text-link" : "text-foreground hover:bg-accent-soft/60",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {on && <Check className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-2 text-sm text-muted">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Sort, category and favorites filters. State lives in the URL so it survives refresh and can be shared. */
export function FilterBar({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const sort = params.get("sort") ?? "az";
  const cat = params.get("cat") ?? "";
  const fav = params.get("fav") === "1";
  const active = sort !== "az" || !!cat || fav;

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    router.push(`${path}?${p.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Menu
        icon={ArrowUpDown} label="Sort" value={sort} options={SORTS} active={sort !== "az"}
        onChange={(v) => update({ sort: v === "az" ? "" : v })} width="w-52"
      />
      <Menu
        icon={FolderOpen} label="Category" value={cat} active={!!cat} searchable={categories.length > 7}
        options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        onChange={(v) => update({ cat: v })}
      />
      <button
        type="button" aria-pressed={fav} onClick={() => update({ fav: fav ? "" : "1" })}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
          fav ? "border-accent bg-accent-soft font-medium text-link" : "border-border bg-surface text-foreground hover:bg-accent-soft",
        )}
      >
        <Star className={cn("size-4", fav && "fill-current")} aria-hidden /> Favorites
      </button>
      {active && (
        <button
          type="button" onClick={() => update({ sort: "", cat: "", fav: "" })}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <X className="size-4" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
