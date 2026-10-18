import Link from "next/link";
import { BookOpen, FolderOpen, Plus, Search, Star } from "lucide-react";

export default function HomePage() {
  const shortcuts = [
    { href: "/dictionary", label: "Dictionary", icon: BookOpen },
    { href: "/categories", label: "My Categories", icon: FolderOpen },
    { href: "/favorites", label: "Favorites", icon: Star },
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-muted">Keep learning, one word at a time.</p>
      <form action="/dictionary" className="relative mt-8">
        <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted" aria-hidden />
        <input
          name="q" aria-label="Search words, definitions and examples" placeholder="Search words, definitions, or examples…"
          className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm focus:border-accent focus:outline-none"
        />
      </form>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Link href="/dictionary/new" className="flex flex-col items-center gap-2 rounded-2xl border border-accent-strong bg-accent-strong px-4 py-5 text-sm font-medium text-on-accent hover:brightness-110">
          <Plus className="size-5" aria-hidden /> Add a word
        </Link>
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-5 text-sm hover:bg-accent-soft/60">
            <Icon className="size-5 text-link" aria-hidden /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
