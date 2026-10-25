import { NextResponse, type NextRequest } from "next/server";

/** Signed-in areas: no session cookie → back to sign-in. */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("fd_at") || req.cookies.has("fd_rt");
  if (!hasSession) return NextResponse.redirect(new URL("/sign-in", req.url));
  return NextResponse.next();
}

export const config = {
  // The operator app. Staff workspaces (/workspace/*) join once the API has staff sign-in.
  matcher: [
    "/analyst/:path*",
    "/queue/:path*",
    "/alerts/:path*",
    "/cases/:path*",
    "/watchlist/:path*",
    "/lookup/:path*",
    "/subscribers/:path*",
    "/monitoring/:path*",
    "/prospect/:path*",
    "/trace/:path*",
    "/heatmap/:path*",
    "/network/:path*",
    "/overview/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/account/:path*",
    "/help/:path*",
    "/feedback/:path*",
  ],
};
