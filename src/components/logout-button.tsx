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
      className="theme-button-secondary rounded-full px-4 py-2 text-sm font-semibold"
    >
      {loading ? translate("nav.logging-out") : translate("nav.logout")}
    </button>
  );
}
