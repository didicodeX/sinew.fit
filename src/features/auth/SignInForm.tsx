"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, sendOtp, verifyOtpSignIn } from "@lib/auth/auth-client";
import { APP } from "@shared/config/app";

const RESEND_COOLDOWN_SEC = 60;

const input =
  "h-14 w-full rounded-xl border border-line bg-surface-2 px-4 text-lg text-fg placeholder:text-muted focus:border-accent focus:outline-none";
const primary =
  "h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-50";

export function SignInForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode() {
    setBusy(true);
    setError(null);
    // better-auth returns { error } instead of throwing
    const { error } = await sendOtp(email.trim());
    setBusy(false);
    if (error) {
      setError(error.message ?? "Could not send the code. Try again.");
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SEC);
    return true;
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (await requestCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await verifyOtpSignIn(email.trim(), code);
    if (error) {
      setBusy(false);
      setError(error.status === 403 || error.status === 400 ? "Wrong or expired code." : (error.message ?? "Sign-in failed."));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      setBusy(false);
      setError(error.message ?? "Google sign-in failed.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-bold tracking-tight">{APP.name}</h1>
        <p className="text-muted">
          {step === "email" ? "Sign in to sync your training across devices." : `Enter the 6-digit code sent to ${email}.`}
        </p>
      </header>

      {step === "email" ? (
        <form onSubmit={onEmail} className="space-y-3">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
          <button type="submit" disabled={busy || !email} className={primary}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={onCode} className="space-y-3">
          <label htmlFor="code" className="sr-only">
            Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${input} tabular text-center text-2xl tracking-[0.5em]`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="py-2 text-muted"
            >
              Change email
            </button>
            <button type="button" disabled={busy || cooldown > 0} onClick={requestCode} className="py-2 text-muted disabled:opacity-50">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      ) : null}

      {googleEnabled && step === "email" ? (
        <>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="h-14 w-full rounded-xl border border-line bg-surface text-lg font-medium disabled:opacity-50"
          >
            Continue with Google
          </button>
        </>
      ) : null}
    </div>
  );
}
