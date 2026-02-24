import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Simple cookie-based auth check for edge runtime
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected = pathname.startsWith("/dashboard");
  const isAuthCallback = pathname.startsWith("/auth");

  // Check for supabase session cookie
  const hasSession = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("sb-") &&
        (c.name.includes("-auth-token") || c.name.includes("access-token"))
    );

  // Redirect unauthenticated users away from protected pages
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
