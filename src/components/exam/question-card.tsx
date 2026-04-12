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
    <section className="theme-card rounded-[2rem] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="theme-kicker text-xs font-semibold">{getCategoryLabel(locale, props.question.subject)}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{props.question.question}</h3>
        </div>
        <span className="theme-tag rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]">
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
                  ? "border-white/60 bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-white/12 bg-white/[0.04] text-white/84 hover:border-white/30 hover:bg-white/[0.09]"
              )}
            >
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold", isSelected ? "bg-white text-[#2148c0]" : "bg-white/10 text-white") }>
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
