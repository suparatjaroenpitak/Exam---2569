import { appendStructuredQuestions, getQuestions } from "@/services/question-service";
import { recordExamHistory } from "@/services/history-service";
import { getExamDurationSeconds } from "@/lib/constants";
import { shuffleArray } from "@/utils/shuffle";
import type {
  AnswerKey,
  ExamAnswer,
  ExamCategory,
  ExamSubcategory,
  ExamQuestion,
  ExamSession,
  ExamSubmissionSummary,
  PerformanceBreakdown,
  QuestionChoice
} from "@/lib/types";

function buildChoices(question: Awaited<ReturnType<typeof getQuestions>>[number]): QuestionChoice[] {
  return shuffleArray([
    { key: "A" as AnswerKey, label: "A", text: question.choice_a },
    { key: "B" as AnswerKey, label: "B", text: question.choice_b },
    { key: "C" as AnswerKey, label: "C", text: question.choice_c },
    { key: "D" as AnswerKey, label: "D", text: question.choice_d }
  ]);
}

export async function createExamSession(input: {
  category: ExamCategory;
  subcategory?: ExamSubcategory | "all";
  count?: number;
  durationSecondsOverride?: number;
  difficulty?: "easy" | "medium" | "hard";
}): Promise<ExamSession> {
  const questions = await getQuestions({ subject: input.category, subcategory: input.subcategory, difficulty: input.difficulty });

  if (questions.length === 0) {
    throw new Error(`Not enough questions in ${input.category}. Available: 0`);
  }

  const requestedCount = input.count && input.count > 0 ? input.count : questions.length;
  const actualCount = Math.min(requestedCount, questions.length);
  const selected = shuffleArray(questions).slice(0, actualCount);
  const sessionQuestions: ExamQuestion[] = selected.map((question) => ({
    id: question.id,
    subject: question.subject,
    category: question.subject,
    subcategory: question.subcategory,
    difficulty: question.difficulty,
    question: question.question,
    choices: buildChoices(question)
  }));

  return {
    subject: input.category,
    category: input.category,
    subcategory: input.subcategory ?? "all",
    count: actualCount,
    durationSeconds: input.durationSecondsOverride && input.durationSecondsOverride > 0
      ? input.durationSecondsOverride
      : getExamDurationSeconds(input.category, actualCount),
    questions: sessionQuestions
  };
}

function buildPerformanceBreakdown(labels: string[], review: ExamSubmissionSummary["review"], selector: (item: ExamSubmissionSummary["review"][number]) => string): PerformanceBreakdown[] {
  return labels.map((label) => {
    const items = review.filter((item) => selector(item) === label);
    const correctCount = items.filter((item) => item.isCorrect).length;
    const totalQuestions = items.length;
    const wrongCount = totalQuestions - correctCount;

    return {
      label,
      totalQuestions,
      correctCount,
      wrongCount,
      score: totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100)
    };
  });
}

export async function gradeExamAttempt(input: {
  userId: string;
  category: ExamCategory;
  subcategory?: ExamSubcategory | "all";
  questionIds: string[];
  answers: ExamAnswer[];
  durationSeconds: number;
}): Promise<ExamSubmissionSummary> {
  const allQuestions = await getQuestions({ subject: input.category });
  const questionMap = new Map(allQuestions.map((question) => [question.id, question]));

  const review = input.questionIds
    .map((questionId) => {
      const question = questionMap.get(questionId);

      if (!question) {
        return null;
      }

      const selected = input.answers.find((answer) => answer.questionId === questionId);
      const selectedKey = selected?.selectedKey ?? null;
      const isCorrect = selectedKey === question.correct_answer;

      return {
        questionId: question.id,
        subject: question.subject,
        subcategory: question.subcategory,
        question: question.question,
        choices: [
          { key: "A" as const, label: "A", text: question.choice_a },
          { key: "B" as const, label: "B", text: question.choice_b },
          { key: "C" as const, label: "C", text: question.choice_c },
          { key: "D" as const, label: "D", text: question.choice_d }
        ],
        selectedKey,
        correctKey: question.correct_answer,
        explanation: question.explanation,
        isCorrect
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const correctCount = review.filter((item) => item.isCorrect).length;
  const totalQuestions = review.length;
  const wrongCount = totalQuestions - correctCount;
  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  const performanceBySubject = buildPerformanceBreakdown(
    Array.from(new Set(review.map((item) => item.subject))),
    review,
    (item) => item.subject
  );
  const performanceBySubcategory = buildPerformanceBreakdown(
    Array.from(new Set(review.map((item) => item.subcategory))),
    review,
    (item) => item.subcategory
  );

  await recordExamHistory({
    userId: input.userId,
    subject: input.category,
    category: input.category,
    subcategory: input.subcategory ?? "all",
    totalQuestions,
    correctCount,
    wrongCount,
    score,
    durationSeconds: input.durationSeconds
  });

  return {
    subject: input.category,
    category: input.category,
    subcategory: input.subcategory ?? "all",
    score,
    totalQuestions,
    correctCount,
    wrongCount,
    durationSeconds: input.durationSeconds,
    review,
    performanceBySubject,
    performanceBySubcategory
  };
}

export { appendStructuredQuestions };
