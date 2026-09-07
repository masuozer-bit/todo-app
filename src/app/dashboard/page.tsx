import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Theme preference travels with the server render so the client does not
  // need a second auth roundtrip before it can start loading data
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <Suspense fallback={null}>
      <DashboardClient
        userId={user.id}
        email={user.email}
        serverTheme={(profile?.theme_preference as "light" | "dark" | null) ?? null}
      />
    </Suspense>
  );
}
