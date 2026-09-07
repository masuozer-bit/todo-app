import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Page requests only. API routes, the OAuth callback, static assets and
     * the service worker do not need a session refresh and would only add
     * latency here.
     */
    "/((?!api|auth|_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json)$).*)",
  ],
};
