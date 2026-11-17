import type { Metadata } from "next";
import { QuickEntry } from "@features/import/QuickEntry";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export const metadata: Metadata = { title: "Add past session" };

export default async function ImportPage() {
  const user = await requirePageUser("/import");
  const { exercises } = await getUserProgram(user.id);
  return <QuickEntry exercises={exercises} />;
}
