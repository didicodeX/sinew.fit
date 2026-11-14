"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@lib/auth/auth-client";

export function AccountCard() {
  const router = useRouter();
  const { data } = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="truncate">{data?.user.email ?? "…"}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          router.replace("/signin");
          router.refresh();
        }}
        className="h-11 rounded-xl border border-line px-4 font-medium disabled:opacity-50"
      >
        Sign out
      </button>
    </section>
  );
}
