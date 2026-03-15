"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/preferences-provider";
import { DIFFICULTY_OPTIONS, EXAM_CATEGORIES, EXAM_LENGTH_OPTIONS, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, getSubcategoryLabel } from "@/i18n";
import type { ExamCategory, ExamSubcategory, QuestionDifficulty } from "@/lib/types";

export function ExamConfigCard() {
  const router = useRouter();
  const { locale, translate } = usePreferences();
  const [category, setCategory] = useState<ExamCategory>(EXAM_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState<ExamSubcategory | "all">("all");
  const [count, setCount] = useState<string>(String(EXAM_LENGTH_OPTIONS[0]));
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(DIFFICULTY_OPTIONS[1]);

  function startExam() {
    const params = new URLSearchParams({
      category,
      subcategory,
      difficulty
    });

    if (count !== "all") {
      params.set("count", count);
    }

    router.push(`/exam?${params.toString()}`);
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("dashboard.start-practice")}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("dashboard.build-exam")}</h3>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-300 dark:text-slate-950">{translate("dashboard.one-question-minute")}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.category")}</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value as ExamCategory;
              setCategory(nextCategory);
              setSubcategory("all");
            }}
          >
            {EXAM_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {getCategoryLabel(locale, item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.subcategory")}</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value as ExamSubcategory | "all")}
          >
            <option value="all">{translate("common.all")}</option>
            {SUBJECT_SUBCATEGORIES[category].map((item) => (
              <option key={item} value={item}>
                {getSubcategoryLabel(locale, item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.questions")}</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={count}
              onChange={(event) => setCount(event.target.value)}
          >
              <option value="all">{translate("common.all")}</option>
            {EXAM_LENGTH_OPTIONS.map((item) => (
                <option key={item} value={String(item)}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.difficulty-focus")}</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as QuestionDifficulty)}
          >
            {DIFFICULTY_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {getDifficultyLabel(locale, item)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={startExam}
        className="mt-6 rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sand"
      >
        {translate("dashboard.start-exam")}
      </button>
    </section>
  );
}
