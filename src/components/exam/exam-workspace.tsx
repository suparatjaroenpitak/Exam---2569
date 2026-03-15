"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { ExamRunner } from "@/components/exam/exam-runner";
import { DIFFICULTY_OPTIONS, EXAM_CATEGORIES, EXAM_LENGTH_OPTIONS, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, getSubcategoryLabel } from "@/i18n";
import { formatSeconds } from "@/utils/format";
import type { ExamCategory, ExamSession, ExamSubmissionSummary, ExamSubcategory, QuestionDifficulty } from "@/lib/types";

export default function ExamWorkspace({ isAdmin = false }: { isAdmin?: boolean }) {
  const { locale, translate } = usePreferences();
  const searchParams = useSearchParams();
  const initialCategory = useMemo(
    () => (searchParams.get("category") as ExamCategory) || EXAM_CATEGORIES[0],
    [searchParams]
  );
  const initialCount = useMemo(() => searchParams.get("count") || "all", [searchParams]);
  const initialDifficulty = useMemo(
    () => (searchParams.get("difficulty") as QuestionDifficulty) || DIFFICULTY_OPTIONS[1],
    [searchParams]
  );
  const initialSubcategory = useMemo(
    () => (searchParams.get("subcategory") as ExamSubcategory | "all") || "all",
    [searchParams]
  );

  const [category, setCategory] = useState<ExamCategory>(initialCategory);
  const [subcategory, setSubcategory] = useState<ExamSubcategory | "all">(initialSubcategory);
  const [count, setCount] = useState<string>(initialCount);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(initialDifficulty);
  const [durationMinutesOverride, setDurationMinutesOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [summary, setSummary] = useState<ExamSubmissionSummary | null>(null);

  async function startExam() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{ session: ExamSession }>("/api/exam/create", {
        method: "POST",
        body: JSON.stringify({
          category,
          subcategory,
          count: count === "all" ? undefined : Number(count),
          difficulty,
          durationSecondsOverride: isAdmin && durationMinutesOverride ? Number(durationMinutesOverride) * 60 : undefined
        })
      });
      setSummary(null);
      setSession(response.session);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : translate("message.exam-create-failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!session ? (
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("exam.builder")}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("exam.generate")}</h3>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-slate-800">
              {translate("exam.timer-preview")}: {durationMinutesOverride ? formatSeconds(Number(durationMinutesOverride) * 60) : count === "all" ? translate("exam.all-available") : formatSeconds(Number(count) * 60)}
            </div>
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
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("exam.question-count")}</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              >
                <option value="all">{translate("exam.all-available")}</option>
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
            {isAdmin ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("exam.admin-timer-minutes")}</span>
                <input
                  type="number"
                  min={1}
                  value={durationMinutesOverride}
                  onChange={(event) => setDurationMinutesOverride(event.target.value)}
                  placeholder={translate("exam.admin-timer-placeholder")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            ) : null}
          </div>
          {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            onClick={startExam}
            disabled={loading}
            className="mt-6 rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sand disabled:opacity-60"
          >
            {loading ? translate("exam.preparing") : translate("exam.start-randomized")}
          </button>
        </section>
      ) : null}

      {session && !summary ? <ExamRunner session={session} canAdjustTimer={isAdmin} onComplete={(result) => setSummary(result)} /> : null}

      {summary ? (
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white dark:bg-slate-800">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-300">{translate("exam.score")}</p>
              <p className="mt-2 text-4xl font-bold">{summary.score}%</p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">{translate("exam.correct")}</p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.correctCount}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-rose-700">{translate("exam.wrong")}</p>
                <p className="mt-2 text-2xl font-bold text-rose-900">{summary.wrongCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">{translate("exam.duration")}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatSeconds(summary.durationSeconds)}</p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{translate("dashboard.category")}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">{getCategoryLabel(locale, summary.subject)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{translate("dashboard.subcategory")}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">{getSubcategoryLabel(locale, summary.subcategory ?? "all")}</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{translate("exam.performance-subject")}</p>
              <div className="mt-3 space-y-3">
                {summary.performanceBySubject.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{getCategoryLabel(locale, item.label as ExamCategory)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.correctCount}/{item.totalQuestions} • {item.score}%</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{translate("exam.performance-subcategory")}</p>
              <div className="mt-3 space-y-3">
                {summary.performanceBySubcategory.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{getSubcategoryLabel(locale, item.label as ExamSubcategory)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.correctCount}/{item.totalQuestions} • {item.score}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {summary.review.map((item, index) => (
              <article key={item.questionId} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {translate("exam.question")} {index + 1}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      item.isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {item.isCorrect ? translate("status.correct") : translate("status.wrong")}
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">{item.question}</h4>
                <div className="mt-4 grid gap-2">
                  {item.choices.map((choice) => (
                    <div key={`${item.questionId}-${choice.key}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <span className="font-semibold">{choice.label}.</span> {choice.text}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">
                  {translate("exam.your-answer")}: <span className="font-semibold">{item.selectedKey ?? translate("exam.no-answer")}</span> | {translate("exam.correct-answer")}:{" "}
                  <span className="font-semibold text-accent">{item.correctKey}</span>
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{translate("exam.explanation")}: {item.explanation}</p>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSession(null);
              setSummary(null);
            }}
            className="mt-6 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:text-white"
          >
            {translate("exam.start-another")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
