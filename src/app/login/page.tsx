import { redirect } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

// One private dictionary, one password. The matching Supabase user is created once
// in the Supabase dashboard; its email is APP_EMAIL (server-side only, never sent to the browser).
async function unlock(formData: FormData) {
  "use server";
  const email = process.env.APP_EMAIL;
  if (!email) redirect("/login?error=" + encodeURIComponent("APP_EMAIL is not set. See the README (step 4)."));
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent("That password isn't right."));
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">My Dictionary</h1>
        <p className="mt-1 text-sm text-muted">Enter your password to open your dictionary.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <form action={unlock} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </div>
          <Button type="submit" variant="primary" className="w-full">Open</Button>
        </form>
      </Card>
    </main>
  );
}
