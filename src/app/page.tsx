import { redirect } from "next/navigation";

/**
 * Unreachable in practice: the middleware already redirects "/" based on the
 * session. Kept as a plain fallback — the old try/catch caught the redirect
 * itself and sent everyone to /login.
 */
export default function Home() {
  redirect("/login");
}
