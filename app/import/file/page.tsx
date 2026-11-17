import type { Metadata } from "next";
import { ImportWizard } from "@features/import/ImportWizard";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export const metadata: Metadata = { title: "Import a spreadsheet" };

export default async function ImportFilePage() {
  const user = await requirePageUser("/import/file");
  const { exercises } = await getUserProgram(user.id);
  return <ImportWizard exercises={exercises} />;
}
