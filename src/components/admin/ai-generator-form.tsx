"use client";

import { type FormEvent, useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { DIFFICULTY_OPTIONS, EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, getSubcategoryLabel, translateApiMessage } from "@/i18n";
import type { ExamCategory, ExamSubcategory, QuestionDifficulty } from "@/lib/types";

export function AiGeneratorForm() {
  const { locale, translate } = usePreferences();
  const [category, setCategory] = useState<ExamCategory>(EXAM_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState<ExamSubcategory>(SUBJECT_SUBCATEGORIES[EXAM_CATEGORIES[0]][0]);
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(DIFFICULTY_OPTIONS[1]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<{ message: string }>("/api/admin/generate-questions", {
        method: "POST",
        body: JSON.stringify({ category, subcategory, count, difficulty })
      });
      setMessage(translateApiMessage(locale, response.message));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : translate("message.generation-failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.ai-generator")}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("admin.create-ai")}</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.category")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={category}
              onChange={(event) => {
                const nextCategory = event.target.value as ExamCategory;
                setCategory(nextCategory);
                setSubcategory(SUBJECT_SUBCATEGORIES[nextCategory][0]);
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
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("admin.subcategory")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={subcategory}
              onChange={(event) => setSubcategory(event.target.value as ExamSubcategory)}
            >
              {SUBJECT_SUBCATEGORIES[category].map((item) => (
                <option key={item} value={item}>
                  {getSubcategoryLabel(locale, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.questions")}</span>
            <input
              min={1}
              max={100}
              type="number"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("admin.difficulty")}</span>
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
        {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sand disabled:opacity-60"
        >
          {loading ? translate("admin.generating") : translate("admin.generate")}
        </button>
      </form>
    </section>
  );
}
