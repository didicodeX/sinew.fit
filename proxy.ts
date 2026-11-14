import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route guard (cookie presence only, no DB call). Real authorisation happens
 * server-side on every data access via requireUserId(); this only routes people to /signin.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (pathname === "/signin") {
    return hasSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

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
