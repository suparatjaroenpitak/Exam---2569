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
    <section className="theme-card rounded-[2rem] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="theme-kicker text-xs font-semibold">{translate("dashboard.start-practice")}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{translate("dashboard.build-exam")}</h3>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#2148c0] shadow-[0_18px_40px_rgba(5,13,42,0.28)]">{translate("dashboard.one-question-minute")}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.category")}</span>
          <select
            className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
          <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.subcategory")}</span>
          <select
            className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
          <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.questions")}</span>
          <select
            className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
          <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.difficulty-focus")}</span>
          <select
            className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
        className="theme-button-primary mt-6 rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
      >
        {translate("dashboard.start-exam")}
      </button>
    </section>
  );
}
