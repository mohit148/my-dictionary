"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage blocked: the choice just won't persist */ }
  }
  return (
    <button
      type="button" onClick={toggle} aria-label="Switch between light and dark theme"
      className={`grid size-9 place-items-center rounded-xl border border-border bg-surface text-muted hover:text-foreground ${className}`}
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}
