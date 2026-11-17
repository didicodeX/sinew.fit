import type { Metadata } from "next";
import Link from "next/link";
import { BatchList } from "@features/import/BatchList";
import { requirePageUser } from "@/server/current-user";
import { listBatches } from "@/server/import/actions";

export const metadata: Metadata = { title: "Import" };

const card = "block rounded-2xl border border-line bg-surface p-4";

export default async function ImportHubPage() {
  await requirePageUser("/import");
  const batches = await listBatches();
  return (
    <div className="space-y-4">
      <Link href="/history" className="text-sm text-accent">← History</Link>
      <h1 className="text-3xl font-bold tracking-tight">Import</h1>
      <Link href="/import/file" className={card}>
        <span className="block font-semibold">Spreadsheet (CSV / XLSX)</span>
        <span className="block text-sm text-muted">Load many sessions at once, with a preview and one-tap undo.</span>
      </Link>
      <Link href="/import/quick" className={card}>
        <span className="block font-semibold">Quick entry</span>
        <span className="block text-sm text-muted">Type a past session like on the notebook page, duplicate a week.</span>
      </Link>
      <BatchList batches={batches} />
    </div>
  );
}
