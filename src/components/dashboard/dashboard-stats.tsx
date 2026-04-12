"use client";

import { usePreferences } from "@/components/preferences-provider";
import type { DashboardStats as DashboardStatsType } from "@/lib/types";

export function DashboardStats({ stats }: { stats: DashboardStatsType }) {
  const { translate } = usePreferences();

  return (
    <section className="mb-6 grid gap-4 md:grid-cols-3">
      <div className="theme-card rounded-[2rem] p-5">
        <p className="theme-kicker text-xs font-semibold">{translate("dashboard.attempts")}</p>
        <p className="mt-3 text-4xl font-semibold text-white">{stats.totalAttempts}</p>
      </div>
      <div className="theme-card rounded-[2rem] p-5">
        <p className="theme-kicker text-xs font-semibold">{translate("dashboard.best-score")}</p>
        <p className="mt-3 text-4xl font-semibold text-white">{stats.bestScore}%</p>
      </div>
      <div className="theme-card rounded-[2rem] p-5">
        <p className="theme-kicker text-xs font-semibold">{translate("dashboard.average-score")}</p>
        <p className="mt-3 text-4xl font-semibold text-white">{stats.averageScore}%</p>
      </div>
    </section>
  );
}
