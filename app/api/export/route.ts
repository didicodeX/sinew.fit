import { NextResponse } from "next/server";
import { auth } from "@lib/auth/auth";
import { exportAll, toJson } from "@/server/export/export-all";

/** Download everything as one JSON file. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const data = await exportAll(session.user.id);
  const day = data.exportedAt.slice(0, 10);
  return new NextResponse(toJson(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sinew-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
