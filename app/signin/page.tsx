import type { Metadata } from "next";
import { googleEnabled } from "@lib/auth/auth";
import { SignInForm } from "@features/auth/SignInForm";
import { safeNext } from "@shared/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <SignInForm next={safeNext(next)} googleEnabled={googleEnabled} />
    </div>
  );
}
