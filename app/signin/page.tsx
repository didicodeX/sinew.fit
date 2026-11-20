import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@lib/auth/auth";
import { SignInForm } from "@features/auth/SignInForm";
import { safeNext } from "@shared/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Real session check (not just cookie presence), so a stale cookie can't cause a redirect loop
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect(safeNext(next));
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <SignInForm next={safeNext(next)} googleEnabled={googleEnabled} />
    </div>
  );
}
