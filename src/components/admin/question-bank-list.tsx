"use client";

import { useMemo, useState } from "react";

import { usePreferences } from "@/components/preferences-provider";
import { EXAM_CATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, getSubcategoryLabel } from "@/i18n";
import type { ExamCategory, QuestionRecord } from "@/lib/types";

export function QuestionBankList({ questions }: { questions: QuestionRecord[] }) {
  const { locale, translate } = usePreferences();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExamCategory | "all">("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return questions.filter((question) => {
      if (category !== "all" && question.subject !== category) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        question.question,
        question.choice_a,
        question.choice_b,
        question.choice_c,
        question.choice_d,
        question.explanation,
        question.subcategory
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, query, questions]);

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.question-bank-list")}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("admin.question-bank-list-title")}</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{filtered.length} / {questions.length}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate("admin.search-questions")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ExamCategory | "all")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">{translate("common.all")}</option>
            {EXAM_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {getCategoryLabel(locale, item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {filtered.map((question, index) => (
          <article key={question.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-300">{translate("exam.question")} {index + 1}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{getCategoryLabel(locale, question.subject)}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{getSubcategoryLabel(locale, question.subcategory)}</span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-800">{getDifficultyLabel(locale, question.difficulty)}</span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">{question.source}</span>
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">{question.question}</h4>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {[
                ["A", question.choice_a],
                ["B", question.choice_b],
                ["C", question.choice_c],
                ["D", question.choice_d]
              ].map(([label, value]) => (
                <div key={`${question.id}-${label}`} className={`rounded-2xl px-4 py-3 text-sm ${question.correct_answer === label ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>
                  <span className="font-semibold">{label}.</span> {value}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">
              {translate("exam.correct-answer")}: <span className="font-semibold text-accent">{question.correct_answer}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{translate("exam.explanation")}: {question.explanation}</p>
          </article>
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{translate("admin.no-questions-found")}</p>
        ) : null}
      </div>
    </section>
  );
}