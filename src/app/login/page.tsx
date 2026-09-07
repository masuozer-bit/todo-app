"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LogIn } from "lucide-react";
import AuthShell, { Field, GoogleButton } from "@/components/auth/AuthShell";

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email address first, then click again.");
      return;
    }
    setLoading(true);
    setInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setInfo("Check your inbox. The link signs you in, then you can set a new password in settings.");
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Calendar access is asked for later, in settings, when it is used
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("Welcome back")}
      subtitle={t("Sign in to your account")}
      error={error}
      info={info}
      footer={
        <>
          {t("Don't have an account?")}{" "}
          <Link href="/signup" className="text-accent font-medium">{t("Sign up")}</Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <Field id="email" label={t("Email")}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input h-10"
          />
        </Field>

        <Field id="password" label={t("Password")}>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder={t("Enter your password")}
              className="input h-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="icon-btn absolute right-1 top-1"
              aria-label={showPassword ? t("Hide password") : t("Show password")}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="mt-2 text-xs text-text-faint hover:text-text-muted transition-default"
          >
            {t("Forgot your password?")}
          </button>
        </Field>

        <button type="submit" disabled={loading} className="btn btn-primary w-full h-10">
          {loading ? t("Signing in...") : <><LogIn size={16} />{t("Sign in")}</>}
        </button>
      </form>

      <GoogleButton onClick={handleGoogleLogin} disabled={loading} />
    </AuthShell>
  );
}
