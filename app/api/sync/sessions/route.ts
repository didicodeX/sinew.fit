import { NextResponse } from "next/server";
import { auth } from "@lib/auth/auth";
import { loadSessions } from "@/server/sync/load-sessions";
import { saveSessions } from "@/server/sync/save-sessions";
import { syncPushSchema } from "@/server/sync/schemas";

/** Push local sessions (web now, watchOS later). Body: { sessions: SyncSession[] }. */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = syncPushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  }

  const results = await saveSessions(session.user.id, parsed.data.sessions);
  return NextResponse.json({ results });
}

/** Pull the user's sessions (for other devices). Query: ?since=<epoch ms of last pull>. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
  const sessions = await loadSessions(session.user.id, Number.isFinite(since) && since > 0 ? since : 0);
  return NextResponse.json({ sessions });
}
