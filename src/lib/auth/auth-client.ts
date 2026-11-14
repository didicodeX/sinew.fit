import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [emailOTPClient()] });

export const { useSession, signOut } = authClient;

export const sendOtp = (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
export const verifyOtpSignIn = (email: string, otp: string) => authClient.signIn.emailOtp({ email, otp });
