import Link from "next/link";
import { signOutAction } from "@/app/actions/account";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings · My Dictionary" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const count = async (t: string) => (await supabase.from(t).select("*", { count: "exact", head: true })).count ?? 0;
  const [words, cats, diffs] = await Promise.all([count("words"), count("categories"), count("differences")]);
  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted">You are signed in. Signing out asks for your password again on this device.</p>
        <form action={signOutAction} className="mt-4"><Button type="submit">Sign out</Button></form>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Theme</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Switch between the cozy light and dark themes. Your choice is remembered on this device.</p>
        <ThemeToggle />
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          {words.toLocaleString()} words · {cats.toLocaleString()} categories · {diffs.toLocaleString()} comparisons.
          Everything is stored in your own account and visible only to you.
        </p>
        <Link href="/import-export" className="mt-3 inline-block text-sm font-medium text-link underline">Import or export your dictionary</Link>
      </section>
    </div>
  );
}
