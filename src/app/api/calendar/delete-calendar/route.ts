import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  deleteGoogleCalendar,
} from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { google_calendar_id } = await request.json();
  if (!google_calendar_id) {
    return NextResponse.json({ success: true });
  }

  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokens) {
    return NextResponse.json({ success: true });
  }

  const accessToken = await getValidAccessToken(
    tokens,
    async (newAccessToken, newExpiresAt) => {
      await supabase
        .from("google_tokens")
        .update({ access_token: newAccessToken, expires_at: newExpiresAt })
        .eq("user_id", user.id);
    }
  );

  if (!accessToken) {
    return NextResponse.json({ success: true });
  }

  await deleteGoogleCalendar(accessToken, google_calendar_id);
  return NextResponse.json({ success: true });
}
