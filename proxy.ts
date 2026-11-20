import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route guard (cookie presence only, no DB call). Real authorisation happens
 * server-side on every data access via requireUserId(); this only routes people to /signin.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  // Never bounce /signin -> / here: a cookie can be present but stale (expired or revoked
  // session), and the page guard would then send us straight back, looping forever.
  // The sign-in page checks the session for real and redirects valid users itself.
  if (pathname === "/signin") return NextResponse.next();

  if (!hasSession) {
    const url = new URL("/signin", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except auth API, Next internals, PWA assets and files with an extension
  matcher: ["/((?!api|_next/static|_next/image|icons|apple-icon|.*\\..*).*)"],
};
