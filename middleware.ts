import { NextRequest, NextResponse } from "next/server";

// Routes that don't require the beta cookie
// "/" is the public landing page — always accessible
const BETA_EXEMPT = [
  "/",
  "/beta",
  "/api/beta/verify",
  "/_next",
  "/favicon.ico",
];

function isBetaExempt(pathname: string) {
  return BETA_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBetaExempt(pathname)) return NextResponse.next();

  const betaCookie = req.cookies.get("beta_access")?.value;
  if (!betaCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/beta";
    // Preserve the intended destination so we can redirect after the gate
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything except static files and images.
     * Beta gate is checked before any auth — an unapproved visitor
     * never reaches /login or the app at all.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
