import { NextRequest, NextResponse } from "next/server";

// NextAuth v4 default JWT session cookie names (secure vs. non-secure host).
const SESSION_COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

/**
 * Re-issues the just-set NextAuth session cookie without Max-Age/Expires,
 * demoting it to a browser-session cookie (cleared when the browser fully
 * closes) for "Remember me" left unchecked. The underlying JWT is untouched
 * and still valid server-side for the full session.maxAge — only the
 * browser's retention of the cookie changes.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });

  for (const name of SESSION_COOKIE_NAMES) {
    const value = req.cookies.get(name)?.value;
    if (value) {
      res.cookies.set(name, value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: name.startsWith("__Secure-"),
      });
    }
  }

  return res;
}
