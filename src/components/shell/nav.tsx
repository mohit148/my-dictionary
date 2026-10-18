"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, FolderOpen, GitCompare, Home, Menu, Plus, Settings, Star, Upload, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dictionary", label: "Dictionary", icon: BookOpen },
  { href: "/favorites", label: "Favorites", icon: Star },
  { href: "/categories", label: "My Categories", icon: FolderOpen },
  { href: "/differences", label: "Differences", icon: GitCompare },
  { href: "/import-export", label: "Import / Export", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              active ? "bg-accent-soft font-medium text-link" : "text-muted hover:bg-accent-soft/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const AddWordButton = ({ onNavigate }: { onNavigate?: () => void }) => (
  <Link
    href="/dictionary/new"
    onClick={onNavigate}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-accent-strong bg-accent-strong px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-110"
  >
    <Plus className="size-4" aria-hidden /> Add Word
  </Link>
);

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface/60 p-4 md:flex">
      <Link href="/" className="flex items-center gap-2 px-2 pt-1 font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-link">
          <BookOpen className="size-4" aria-hidden />
        </span>
        My Dictionary
      </Link>
      <AddWordButton />
      <Links />
      <ThemeToggle className="mt-auto" />
    </aside>
  );
}

export function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="font-semibold">My Dictionary</Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/dictionary/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent-strong px-3 text-sm font-medium text-on-accent"
        >
          <Plus className="size-4" aria-hidden /> Add Word
        </Link>
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-xl border border-border bg-surface"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-surface p-3 shadow-sm">
          <Links onNavigate={() => setOpen(false)} />
        </div>
      )}
    </header>
  );
}
