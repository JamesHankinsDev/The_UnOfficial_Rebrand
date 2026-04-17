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

  // Redirect authenticated users away from login
  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/trade-machine", "/cards"],
};
