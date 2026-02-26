import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Capture Google provider tokens for Calendar API access
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;

      if (providerToken) {
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        await supabase.from("google_tokens").upsert(
          {
            user_id: data.session.user.id,
            access_token: providerToken,
            refresh_token: providerRefreshToken,
            expires_at: expiresAt,
            scopes: "https://www.googleapis.com/auth/calendar.events",
          },
          { onConflict: "user_id" }
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
