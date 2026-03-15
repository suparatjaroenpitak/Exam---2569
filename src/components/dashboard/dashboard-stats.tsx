"use client";

import { usePreferences } from "@/components/preferences-provider";
import type { DashboardStats as DashboardStatsType } from "@/lib/types";

export function DashboardStats({ stats }: { stats: DashboardStatsType }) {
  const { translate } = usePreferences();

  return (
    <section className="mb-6 grid gap-4 md:grid-cols-3">
      <div className="rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("dashboard.attempts")}</p>
        <p className="mt-3 text-4xl font-bold text-slate-950 dark:text-slate-100">{stats.totalAttempts}</p>
      </div>
      <div className="rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("dashboard.best-score")}</p>
        <p className="mt-3 text-4xl font-bold text-slate-950 dark:text-slate-100">{stats.bestScore}%</p>
      </div>
      <div className="rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("dashboard.average-score")}</p>
        <p className="mt-3 text-4xl font-bold text-slate-950 dark:text-slate-100">{stats.averageScore}%</p>
      </div>
    </section>
  );
}
