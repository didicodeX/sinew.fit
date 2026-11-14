"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SessionView } from "@features/session/SessionView";

/**
 * Static shell: all data comes from IndexedDB, so this page works with no network
 * once the service worker has cached it.
 */
function SessionRoute() {
  const id = useSearchParams().get("id");
  if (!id) return <p className="py-10 text-center text-muted">No session selected.</p>;
  return <SessionView id={id} />;
}

export default function SessionPage() {
  return (
    <Suspense fallback={<div className="h-40" aria-busy />}>
      <SessionRoute />
    </Suspense>
  );
}
