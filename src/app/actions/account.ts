"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteDifferenceAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await supabase.from("differences").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  revalidatePath("/differences");
  return { ok: true };
}
