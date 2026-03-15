"use client";

import { usePreferences } from "@/components/preferences-provider";
import { getCategoryLabel, getDifficultyLabel } from "@/i18n";
import { cn } from "@/utils/format";
import type { AnswerKey, ExamQuestion } from "@/lib/types";

export function QuestionCard(props: {
  question: ExamQuestion;
  selectedKey: AnswerKey | null;
  onSelect: (key: AnswerKey) => void;
}) {
  const { locale } = usePreferences();

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{getCategoryLabel(locale, props.question.subject)}</p>
          <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-100">{props.question.question}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          {getDifficultyLabel(locale, props.question.difficulty)}
        </span>
      </div>

      <div className="grid gap-3">
        {props.question.choices.map((choice) => {
          const isSelected = props.selectedKey === choice.key;

          return (
            <button
              key={`${props.question.id}-${choice.key}`}
              type="button"
              onClick={() => props.onSelect(choice.key)}
              className={cn(
                "flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition",
                isSelected
                  ? "border-accent bg-teal-50 text-slate-950 dark:bg-teal-950/40 dark:text-slate-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-slate-700">
                {choice.label}
              </span>
              <span className="text-sm sm:text-base">{choice.text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
