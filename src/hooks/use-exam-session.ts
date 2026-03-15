"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AnswerKey, ExamAnswer, ExamQuestion, ExamSession } from "@/lib/types";

export function useExamSession(session: ExamSession, onTimeExpired: (payload: ExamAnswer[]) => void) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerKey | null>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(session.durationSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setCurrentIndex(0);
    setAnswers({});
    setTimeLeftSeconds(session.durationSeconds);
  }, [session]);

  useEffect(() => {
    if (timeLeftSeconds <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onTimeExpired(
          session.questions.map((question) => ({
            questionId: question.id,
            selectedKey: answers[question.id] ?? null
          }))
        );
      }

      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeLeftSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [answers, onTimeExpired, session.questions, timeLeftSeconds]);

  const currentQuestion = session.questions[currentIndex] as ExamQuestion;
  const answeredCount = useMemo(
    () => Object.values(answers).filter((answer) => answer !== null).length,
    [answers]
  );

  function selectAnswer(questionId: string, selectedKey: AnswerKey) {
    setAnswers((current) => ({
      ...current,
      [questionId]: selectedKey
    }));
  }

  function jumpTo(index: number) {
    setCurrentIndex(index);
  }

  function next() {
    setCurrentIndex((current) => Math.min(current + 1, session.questions.length - 1));
  }

  function previous() {
    setCurrentIndex((current) => Math.max(current - 1, 0));
  }

  function toPayload(): ExamAnswer[] {
    return session.questions.map((question) => ({
      questionId: question.id,
      selectedKey: answers[question.id] ?? null
    }));
  }

  return {
    currentIndex,
    currentQuestion,
    answers,
    answeredCount,
    timeLeftSeconds,
    progressPercentage: Math.round((answeredCount / session.questions.length) * 100),
    jumpTo,
    next,
    previous,
    selectAnswer,
    toPayload
  };
}
