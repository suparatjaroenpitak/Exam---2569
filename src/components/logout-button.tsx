"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { translate } = usePreferences();

  async function handleLogout() {
    setLoading(true);

    try {
      await apiRequest<{ success: boolean }>("/api/auth/logout", {
        method: "POST"
      });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:text-white"
    >
      {loading ? translate("nav.logging-out") : translate("nav.logout")}
    </button>
  );
}
