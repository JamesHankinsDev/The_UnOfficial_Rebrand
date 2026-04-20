import { type NextRequest, NextResponse } from "next/server";
import { GATED_ROUTES, features } from "@/lib/features";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("__session");

  // Feature gates — redirect disabled routes to home
  for (const [route, featureKey] of Object.entries(GATED_ROUTES)) {
    if (pathname.startsWith(route) && !features[featureKey]) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Redirect unauthenticated users away from dashboard
  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Note: the /login → /dashboard redirect lives in the login page itself
  // because only a role check (writer/admin/owner vs member) can route correctly,
  // and middleware only sees the opaque __session cookie.

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/trade-machine", "/cards"],
};
