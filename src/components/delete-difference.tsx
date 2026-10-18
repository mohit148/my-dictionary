"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDifferenceAction } from "@/app/actions/account";
import { Button } from "@/components/ui";

export function DeleteDifference({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!sure) return <Button size="sm" variant="danger" onClick={() => setSure(true)}><Trash2 className="size-4" /> Delete</Button>;
  return (
    <span role="alert" className="inline-flex items-center gap-2 text-sm text-danger">
      Delete this comparison?
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => {
        const r = await deleteDifferenceAction(id);
        if (r.ok) router.refresh(); else setErr(r.error ?? "Failed");
      })}>Yes</Button>
      <Button size="sm" onClick={() => setSure(false)}>No</Button>{err}
    </span>
  );
}
