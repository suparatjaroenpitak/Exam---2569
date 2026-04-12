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
        <section className="theme-card rounded-[2rem] p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="theme-kicker text-xs font-semibold">{translate("exam.builder")}</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{translate("exam.generate")}</h3>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#2148c0] shadow-[0_18px_40px_rgba(5,13,42,0.28)]">
              {translate("exam.timer-preview")}: {durationMinutesOverride ? formatSeconds(Number(durationMinutesOverride) * 60) : count === "all" ? translate("exam.all-available") : formatSeconds(Number(count) * 60)}
            </div>
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
              <span className="mb-2 block text-sm font-medium text-white/72">{translate("exam.question-count")}</span>
              <select
                className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
            {isAdmin ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/72">{translate("exam.admin-timer-minutes")}</span>
                <input
                  type="number"
                  min={1}
                  value={durationMinutesOverride}
                  onChange={(event) => setDurationMinutesOverride(event.target.value)}
                  placeholder={translate("exam.admin-timer-placeholder")}
                  className="theme-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
            ) : null}
          </div>
          {error ? <p className="theme-message-error mt-4 rounded-2xl px-4 py-3 text-sm">{error}</p> : null}
          <button
            type="button"
            onClick={startExam}
            disabled={loading}
            className="theme-button-primary mt-6 rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
          >
            {loading ? translate("exam.preparing") : translate("exam.start-randomized")}
          </button>
        </section>
      ) : null}

      {session && !summary ? <ExamRunner session={session} canAdjustTimer={isAdmin} onComplete={(result) => setSummary(result)} /> : null}

      {summary ? (
        <section className="theme-card rounded-[2rem] p-6">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="rounded-3xl bg-white px-5 py-4 text-[#2148c0] shadow-[0_18px_40px_rgba(5,13,42,0.28)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[#2148c0]/65">{translate("exam.score")}</p>
              <p className="mt-2 text-4xl font-semibold">{summary.score}%</p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200/18 bg-emerald-500/16 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{translate("exam.correct")}</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-50">{summary.correctCount}</p>
              </div>
              <div className="rounded-2xl border border-rose-200/18 bg-rose-500/16 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-rose-100">{translate("exam.wrong")}</p>
                <p className="mt-2 text-2xl font-semibold text-rose-50">{summary.wrongCount}</p>
              </div>
              <div className="theme-card-soft rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">{translate("exam.duration")}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formatSeconds(summary.durationSeconds)}</p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="theme-card-soft rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">{translate("dashboard.category")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{getCategoryLabel(locale, summary.subject)}</p>
            </div>
            <div className="theme-card-soft rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">{translate("dashboard.subcategory")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{getSubcategoryLabel(locale, summary.subcategory ?? "all")}</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <div className="theme-card-soft rounded-2xl p-4">
              <p className="text-sm font-semibold text-white">{translate("exam.performance-subject")}</p>
              <div className="mt-3 space-y-3">
                {summary.performanceBySubject.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <p className="font-medium text-white">{getCategoryLabel(locale, item.label as ExamCategory)}</p>
                    <p className="text-sm text-white/66">{item.correctCount}/{item.totalQuestions} • {item.score}%</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="theme-card-soft rounded-2xl p-4">
              <p className="text-sm font-semibold text-white">{translate("exam.performance-subcategory")}</p>
              <div className="mt-3 space-y-3">
                {summary.performanceBySubcategory.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <p className="font-medium text-white">{getSubcategoryLabel(locale, item.label as ExamSubcategory)}</p>
                    <p className="text-sm text-white/66">{item.correctCount}/{item.totalQuestions} • {item.score}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {summary.review.map((item, index) => (
              <article key={item.questionId} className="theme-card-soft rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="theme-tag rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
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
                <h4 className="mt-4 text-lg font-semibold text-white">{item.question}</h4>
                <div className="mt-4 grid gap-2">
                  {item.choices.map((choice) => (
                    <div key={`${item.questionId}-${choice.key}`} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/82">
                      <span className="font-semibold">{choice.label}.</span> {choice.text}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-white/82">
                  {translate("exam.your-answer")}: <span className="font-semibold">{item.selectedKey ?? translate("exam.no-answer")}</span> | {translate("exam.correct-answer")}:{" "}
                  <span className="font-semibold text-[#dbe6ff]">{item.correctKey}</span>
                </p>
                <p className="mt-2 text-sm text-white/66">{translate("exam.explanation")}: {item.explanation}</p>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSession(null);
              setSummary(null);
            }}
            className="theme-button-secondary mt-6 rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            {translate("exam.start-another")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
