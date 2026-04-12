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
  canAdjustTimer?: boolean;
  onComplete: (summary: ExamSubmissionSummary) => void;
}) {
  const { locale, translate } = usePreferences();
  const [submitting, setSubmitting] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("");

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
        <div className="theme-card rounded-[2rem] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="theme-kicker text-xs font-semibold">{translate("exam.live")}</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{getCategoryLabel(locale, props.session.subject)}</h3>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-center text-[#2148c0] shadow-[0_18px_40px_rgba(5,13,42,0.28)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[#2148c0]/65">{translate("exam.time-left")}</p>
              <p className="mt-1 text-2xl font-semibold">{formatSeconds(exam.timeLeftSeconds)}</p>
            </div>
          </div>
          <div className="theme-progress-track mt-5 h-3 overflow-hidden rounded-full">
            <div className="theme-progress-bar h-full rounded-full transition-all" style={{ width: `${exam.progressPercentage}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-white/72">
            <span>
              {translate("exam.question")} {exam.currentIndex + 1} {translate("exam.of")} {props.session.questions.length}
            </span>
            <span>{exam.answeredCount} {translate("exam.answered")}</span>
          </div>
          {props.canAdjustTimer ? (
            <div className="theme-card-soft mt-4 flex flex-wrap items-end gap-3 rounded-2xl px-4 py-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/72">{translate("exam.admin-adjust-timer")}</span>
                <input
                  type="number"
                  min={0}
                  value={timerMinutes}
                  onChange={(event) => setTimerMinutes(event.target.value)}
                  placeholder={translate("exam.admin-timer-placeholder")}
                  className="theme-input w-40 rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!timerMinutes) {
                    return;
                  }

                  exam.setRemainingTime(Number(timerMinutes) * 60);
                }}
                className="theme-button-primary rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em]"
              >
                {translate("exam.apply-timer")}
              </button>
            </div>
          ) : null}
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
            className="theme-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            {translate("exam.previous")}
          </button>
          <button
            type="button"
            onClick={exam.next}
            className="theme-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            {translate("exam.next")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit(exam.toPayload())}
            className="theme-button-primary rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
          >
            {submitting ? translate("exam.submitting") : translate("exam.submit")}
          </button>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="theme-card rounded-[2rem] p-6">
          <p className="theme-kicker text-xs font-semibold">{translate("exam.navigation")}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{translate("exam.jump")}</h3>
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
