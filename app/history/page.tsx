"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HistoryList } from "@features/history/HistoryList";
import { SessionDetail } from "@features/history/SessionDetail";

/** Static shell: list and detail both read from IndexedDB, so history works offline. */
function HistoryRoute() {
  const id = useSearchParams().get("id");
  return id ? <SessionDetail id={id} /> : <HistoryList />;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="h-40" aria-busy />}>
      <HistoryRoute />
    </Suspense>
  );
}
