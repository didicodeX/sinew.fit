import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BatchList } from "@features/import/BatchList";
import { CameraIcon, PencilIcon, TableIcon } from "@shared/components/icons";
import { requirePageUser } from "@/server/current-user";
import { listBatches } from "@/server/import/actions";

export const metadata: Metadata = { title: "Import" };

function Option({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-bg text-accent">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </Link>
  );
}

export default async function ImportHubPage() {
  await requirePageUser("/import");
  const batches = await listBatches();
  return (
    <div className="space-y-4">
      <Link href="/history" className="text-sm text-accent">← History</Link>
      <h1 className="text-3xl font-bold tracking-tight">Import</h1>
      <Option href="/import/photo" icon={<CameraIcon />} title="Notebook photos"
        text="Photograph your notebook pages. Sinew reads them, you check each session, then import with one-tap undo." />
      <Option href="/import/file" icon={<TableIcon />} title="Spreadsheet (CSV / XLSX)"
        text="Load many sessions at once, with a preview and one-tap undo." />
      <Option href="/import/quick" icon={<PencilIcon />} title="Quick entry"
        text="Type a past session like on the notebook page, duplicate a week." />
      <BatchList batches={batches} />
    </div>
  );
}
