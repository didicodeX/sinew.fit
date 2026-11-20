import type { Metadata } from "next";
import { PhotoImport } from "@features/import/PhotoImport";
import { env } from "@/env";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export const metadata: Metadata = { title: "Import notebook photos" };
// A notebook photo can take a while to read
export const maxDuration = 60;

export default async function ImportPhotoPage() {
  const user = await requirePageUser("/import/photo");
  const { exercises } = await getUserProgram(user.id);
  return <PhotoImport exercises={exercises} enabled={Boolean(env.GEMINI_API_KEY)} />;
}
