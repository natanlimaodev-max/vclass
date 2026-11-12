import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional password protection for the whole app (pages, API routes and models).
 * Set APP_PASSWORD to enable it; the browser shows its native login prompt
 * (any username, the password must match). Leave it empty for local use.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function passwordFrom(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice("Basic ".length));
    const sep = decoded.indexOf(":");
    return sep === -1 ? null : decoded.slice(sep + 1);
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.next();

  const given = passwordFrom(req.headers.get("authorization"));
  if (given !== null && safeEqual(given, expected)) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="VClass", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
