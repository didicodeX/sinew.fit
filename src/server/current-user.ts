import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lib/auth/auth";

/** For server components: the signed-in user's id, or a redirect to /signin. */
export async function requirePageUser(next = "/"): Promise<{ id: string; email: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(next === "/" ? "/signin" : `/signin?next=${encodeURIComponent(next)}`);
  return { id: session.user.id, email: session.user.email };
}
