"use client";

import { usePreferences } from "@/components/preferences-provider";
import { getCategoryLabel, getDifficultyLabel } from "@/i18n";
import { EXAM_CATEGORIES } from "@/lib/constants";
import type { QuestionStats } from "@/lib/types";

export function AdminOverview({ stats }: { stats: QuestionStats }) {
  const { locale, translate } = usePreferences();

  return (
    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.question-bank")}</p>
        <h3 className="mt-2 text-4xl font-bold text-slate-950 dark:text-slate-100">{stats.totalQuestions}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{translate("admin.available-questions")}</p>
      </div>
      <div className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.coverage")}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {EXAM_CATEGORIES.map((category) => (
            <div key={category} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{getCategoryLabel(locale, category)}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{stats.byCategory[category]}</p>
            </div>
          ))}
          <div className="rounded-2xl bg-teal-50 p-4">
            <p className="text-sm font-medium text-teal-700">{translate("admin.difficulty-mix")}</p>
            <p className="mt-2 text-lg font-bold text-teal-950">
              {stats.byDifficulty.easy} {getDifficultyLabel(locale, "easy")} / {stats.byDifficulty.medium} {getDifficultyLabel(locale, "medium")} / {stats.byDifficulty.hard} {getDifficultyLabel(locale, "hard")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
