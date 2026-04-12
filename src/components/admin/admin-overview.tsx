"use client";

import { usePreferences } from "@/components/preferences-provider";
import { getCategoryLabel, getDifficultyLabel } from "@/i18n";
import { EXAM_CATEGORIES } from "@/lib/constants";
import type { QuestionStats } from "@/lib/types";

export function AdminOverview({ stats }: { stats: QuestionStats }) {
  const { locale, translate } = usePreferences();

  return (
    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="theme-card rounded-[2rem] p-6">
        <p className="theme-kicker text-xs font-semibold">{translate("admin.question-bank")}</p>
        <h3 className="mt-2 text-4xl font-semibold text-white">{stats.totalQuestions}</h3>
        <p className="mt-2 text-sm text-white/72">{translate("admin.available-questions")}</p>
      </div>
      <div className="theme-card rounded-[2rem] p-6">
        <p className="theme-kicker text-xs font-semibold">{translate("admin.coverage")}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {EXAM_CATEGORIES.map((category) => (
            <div key={category} className="theme-card-soft rounded-2xl p-4">
              <p className="text-sm font-medium text-white/72">{getCategoryLabel(locale, category)}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.byCategory[category]}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-white/14 bg-white/[0.12] p-4">
            <p className="text-sm font-medium text-white/72">{translate("admin.difficulty-mix")}</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {stats.byDifficulty.easy} {getDifficultyLabel(locale, "easy")} / {stats.byDifficulty.medium} {getDifficultyLabel(locale, "medium")} / {stats.byDifficulty.hard} {getDifficultyLabel(locale, "hard")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
