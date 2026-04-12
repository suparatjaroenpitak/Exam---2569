"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { BrandMark } from "@/components/ui/brand-mark";

type AuthMode = "login" | "register";

function AuthFieldIcon({ kind }: { kind: "user" | "mail" | "lock" }) {
  if (kind === "lock") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 10V7a5 5 0 0 1 10 0v3" strokeLinecap="round" />
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M12 14v2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "mail") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  );
}

function AuthField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: "user" | "mail" | "lock";
  type?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{props.label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white">
          <AuthFieldIcon kind={props.icon} />
        </span>
        <input
          required
          autoComplete={props.autoComplete}
          minLength={props.minLength}
          type={props.type ?? "text"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.label}
          className="theme-auth-input w-full py-3 pl-[41px] pr-4"
        />
      </div>
    </label>
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { translate } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;

      const response = await apiRequest<{ user: { role: "admin" | "user" } }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      router.push(response.user.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : translate("message.request-failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="theme-auth-stack w-full">
      <div className="mb-12 flex flex-col items-center text-center">
        <BrandMark className="h-[98px] w-[124px]" />
        {mode === "register" ? <p className="mt-8 text-sm text-white/72">{translate("auth.register.description")}</p> : null}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <AuthField
            label={translate("auth.name")}
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            icon="user"
            autoComplete="name"
          />
        ) : null}

        <AuthField
          label={translate("auth.email")}
          value={form.email}
          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          icon="mail"
          type="email"
          autoComplete="email"
        />

        <AuthField
          label={translate("auth.password")}
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          icon="lock"
          type="password"
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {error ? <p className="theme-message-error rounded-2xl px-4 py-3 text-sm">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="theme-button-primary mt-3 h-[45px] w-full rounded-md px-4 text-base font-semibold uppercase tracking-[0.08em]"
        >
          {loading ? translate("auth.loading") : mode === "login" ? translate("auth.login.submit") : translate("auth.register.submit")}
        </button>
      </form>

      {mode === "login" ? (
        <div className="mt-3 flex justify-end">
          <button type="button" className="theme-auth-link text-base font-medium">
            Forgot password?
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-white/74">
        <span>{mode === "login" ? translate("auth.need-account") : translate("auth.have-account")}</span>
        <Link className="theme-auth-link font-semibold uppercase tracking-[0.08em]" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? translate("auth.register.submit") : translate("auth.login.submit")}
        </Link>
      </div>
    </div>
  );
}
