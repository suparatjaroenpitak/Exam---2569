"use client";

import { useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { useExamSession } from "@/hooks/use-exam-session";
import { QuestionCard } from "@/components/exam/question-card";
import { QuestionPalette } from "@/components/exam/question-palette";
import { getCategoryLabel } from "@/i18n";
import { formatSeconds } from "@/utils/format";
import type { ExamAnswer, ExamSession, ExamSubmissionSummary } from "@/lib/types";

export function ExamRunner(props: {
  session: ExamSession;
  onComplete: (summary: ExamSubmissionSummary) => void;
}) {
  const { locale, translate } = usePreferences();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(answers: ExamAnswer[]) {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const summary = await apiRequest<{ summary: ExamSubmissionSummary }>("/api/exam/submit", {
        method: "POST",
        body: JSON.stringify({
          category: props.session.category,
          subcategory: props.session.subcategory,
          questionIds: props.session.questions.map((question) => question.id),
          answers,
          durationSeconds: props.session.durationSeconds - exam.timeLeftSeconds
        })
      });

      props.onComplete(summary.summary);
    } finally {
      setSubmitting(false);
    }
  }

  const exam = useExamSession(props.session, (answers) => {
    void handleSubmit(answers);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.7fr]">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("exam.live")}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{getCategoryLabel(locale, props.session.subject)}</h3>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white dark:bg-slate-800">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-300">{translate("exam.time-left")}</p>
              <p className="mt-1 text-2xl font-bold">{formatSeconds(exam.timeLeftSeconds)}</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-ember transition-all" style={{ width: `${exam.progressPercentage}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>
              {translate("exam.question")} {exam.currentIndex + 1} {translate("exam.of")} {props.session.questions.length}
            </span>
            <span>{exam.answeredCount} {translate("exam.answered")}</span>
          </div>
        </div>

        <QuestionCard
          question={exam.currentQuestion}
          selectedKey={exam.answers[exam.currentQuestion.id] ?? null}
          onSelect={(key) => exam.selectAnswer(exam.currentQuestion.id, key)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exam.previous}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:text-white"
          >
            {translate("exam.previous")}
          </button>
          <button
            type="button"
            onClick={exam.next}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:text-white"
          >
            {translate("exam.next")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit(exam.toPayload())}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? translate("exam.submitting") : translate("exam.submit")}
          </button>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("exam.navigation")}</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-100">{translate("exam.jump")}</h3>
          <div className="mt-5">
            <QuestionPalette
              total={props.session.questions.length}
              currentIndex={exam.currentIndex}
              answeredQuestionIds={Object.entries(exam.answers)
                .filter(([, value]) => value)
                .map(([key]) => key)}
              questionIds={props.session.questions.map((question) => question.id)}
              onSelect={exam.jumpTo}
            />
          </div>
        </section>
      </aside>
    </div>
  );
}
