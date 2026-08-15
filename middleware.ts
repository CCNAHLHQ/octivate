import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOCKED = [
  /\.env/i,
  /wp-admin/i,
  /phpmyadmin/i,
  /\.git/i,
  /\/vendor\//i,
];

const SESSION_COOKIE = "octivate_session";
const SESSION_EXP_COOKIE = "octivate_session_exp";

function clearSessionCookies(res: NextResponse) {
  const clear = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(SESSION_COOKIE, "", clear);
  res.cookies.set(SESSION_EXP_COOKIE, "", { ...clear, httpOnly: false });
}

function sessionExpired(req: NextRequest): boolean {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return false;
  if (session.length < 16) return true;
  const expRaw = req.cookies.get(SESSION_EXP_COOKIE)?.value;
  if (!expRaw) return false; // legacy cookies — SessionGuard + /api/auth/me enforce
  const exp = Date.parse(expRaw);
  return Number.isFinite(exp) && exp <= Date.now();
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BLOCKED.some((re) => re.test(pathname))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const isPublicSample =
    pathname === "/sample" ||
    pathname === "/sample/brief" ||
    pathname.startsWith("/sample/");
  const isDashboard = pathname.startsWith("/dashboard");
  const isOperator =
    pathname.startsWith("/dashboard/operator") || pathname === "/operator";
  const isAuthPage = pathname === "/signin" || pathname === "/signup";
  const signedOut =
    req.nextUrl.searchParams.get("signed_out") === "1" ||
    req.nextUrl.searchParams.get("reason") === "signed_out";
  const expired = sessionExpired(req);

  // Hard sign-out: clear sticky cookies and allow the auth page through.
  if (signedOut && isAuthPage) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("signed_out");
    if (url.searchParams.get("reason") === "signed_out") {
      url.searchParams.delete("reason");
    }
    const res = NextResponse.redirect(url);
    clearSessionCookies(res);
    // Also clear insecure variants in case Secure mismatch left a cookie behind.
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(SESSION_EXP_COOKIE, "", {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });
    applySecurityHeaders(req, res);
    return res;
  }

  if (expired && (isDashboard || isAuthPage)) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", isDashboard ? pathname : "/dashboard");
    url.searchParams.set("reason", "session_expired");
    const res = NextResponse.redirect(url);
    clearSessionCookies(res);
    applySecurityHeaders(req, res);
    return res;
  }

  if (isPublicSample) {
    const res = NextResponse.next();
    applySecurityHeaders(req, res);
    return res;
  }

  if (isDashboard && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    clearSessionCookies(res);
    applySecurityHeaders(req, res);
    return res;
  }

  if (isAuthPage && session && !expired) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    applySecurityHeaders(req, res);
    return res;
  }

  // Soft marker for operator pages — role is enforced in layout/API.
  if (isOperator) {
    const res = NextResponse.next();
    res.headers.set("x-octivate-operator-route", "1");
    applySecurityHeaders(req, res);
    return res;
  }

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set("X-Request-Id", requestId);
  applySecurityHeaders(req, res);
  return res;
}

function applySecurityHeaders(req: NextRequest, res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=()"
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://www.gstatic.com https://www.google.com",
      "style-src 'self' 'unsafe-inline' https://www.gstatic.com https://translate.googleapis.com",
      "img-src 'self' data: blob: https://flagcdn.com https://www.gstatic.com https://translate.googleapis.com https://*.googleusercontent.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://tile.openstreetmap.org https://image.mux.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://www.google.com https://*.googleapis.com https://www.gstatic.com https://translate.googleapis.com https://translate.google.com https://*.supabase.co wss://*.google.com https://*.basemaps.cartocdn.com https://*.mux.com",
      "frame-src https://translate.google.com https://www.google.com",
      "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  if (req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
