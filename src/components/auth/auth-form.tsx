"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { PreferenceControls } from "@/components/ui/preference-controls";

type AuthMode = "login" | "register";

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
    <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/90 p-8 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6 flex justify-end">
        <PreferenceControls />
      </div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("auth.eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-100">{mode === "login" ? translate("auth.login.title") : translate("auth.register.title")}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {mode === "login"
            ? translate("auth.login.description")
            : translate("auth.register.description")}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("auth.name")}</span>
            <input
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("auth.email")}</span>
          <input
            required
            type="email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("auth.password")}</span>
          <input
            required
            minLength={6}
            type="password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent disabled:opacity-50 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
        >
          {loading ? translate("auth.loading") : mode === "login" ? translate("auth.login.submit") : translate("auth.register.submit")}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <span>{mode === "login" ? translate("auth.need-account") : translate("auth.have-account")}</span>
        <Link className="font-semibold text-accent hover:text-slate-950" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? translate("auth.register.submit") : translate("auth.login.submit")}
        </Link>
      </div>
    </div>
  );
}
