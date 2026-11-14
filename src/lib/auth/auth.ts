import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { Resend } from "resend";
import { db } from "@lib/db";
import { env } from "@/env";
import { APP } from "@shared/config/app";
import { seedUserProgram } from "@/server/program/seed-user";

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function sendOtp(email: string, otp: string) {
  if (!env.RESEND_API_KEY) {
    // Never log codes in production: a missing provider is a configuration error there
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured");
    console.info(`[auth] OTP for ${email}: ${otp}`);
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM ?? `${APP.name} <login@${APP.domain}>`,
    to: email,
    subject: `${otp} is your ${APP.name} code`,
    text: `Your ${APP.name} sign-in code is ${otp}. It expires in 5 minutes.`,
  });
}

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Long-lived sessions: the app is used offline at the gym
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  plugins: [
    emailOTP({
      expiresIn: 300,
      async sendVerificationOTP({ email, otp }) {
        await sendOtp(email, otp);
      },
    }),
    nextCookies(),
  ],
  socialProviders: googleEnabled
    ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
    : {},
  databaseHooks: {
    user: {
      create: {
        // Every new account starts with the program as editable data (brief §7, §9)
        after: async (user) => {
          try {
            await seedUserProgram(user.id);
          } catch (error) {
            // Sign-up must not fail because of seeding; seedUserProgram is idempotent and safe to re-run
            console.error("[auth] program seed failed", { userId: user.id, error });
          }
        },
      },
    },
  },
});

/** Server-side guard: every query is scoped by this user id. */
export async function requireUserId(headers: Headers): Promise<string> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session.user.id;
}
