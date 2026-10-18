import { redirect } from "next/navigation";
import { MobileBar, Sidebar } from "@/components/shell/nav";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <MobileBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-10 md:py-12">{children}</main>
    </div>
  );
}
