"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import AuthShell, { Field, GoogleButton } from "@/components/auth/AuthShell";

export default function SignupPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
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

  if (success) {
    return (
      <AuthShell
        title={t("Check your email")}
        subtitle={t("We sent a confirmation link to {email}", { email })}
        footer={<Link href="/login" className="text-accent font-medium">{t("Back to login")}</Link>}
      >
        <p className="text-[13px] text-text-muted">
          {t("Open the link to finish creating your account.")}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("Create account")}
      subtitle={t("Get started with your to-dos")}
      error={error}
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link href="/login" className="text-accent font-medium">{t("Sign in")}</Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-4">
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
              autoComplete="new-password"
              placeholder={t("At least 6 characters")}
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
        </Field>

        <Field id="confirm" label={t("Confirm password")}>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder={t("Confirm your password")}
            className="input h-10"
          />
        </Field>

        <button type="submit" disabled={loading} className="btn btn-primary w-full h-10">
          {loading ? t("Creating account...") : <><UserPlus size={16} />{t("Create account")}</>}
        </button>
      </form>

      <GoogleButton onClick={handleGoogleSignup} disabled={loading} />
    </AuthShell>
  );
}
