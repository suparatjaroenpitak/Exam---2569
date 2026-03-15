import { appendQuestions, loadQuestions } from "@/lib/excel-db";
import { EXAM_CATEGORIES, getDefaultSubcategory, normalizeSubject } from "@/lib/constants";
import type { ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord, QuestionStats } from "@/lib/types";

const QUESTION_CACHE_TTL_MS = 15_000;

let questionCache: { expiresAt: number; rows: QuestionRecord[] } | null = null;

function createQuestionId() {
  return `question_${crypto.randomUUID()}`;
}

function normalizeQuestion(row: QuestionRecord): QuestionRecord | null {
  const subject = normalizeSubject(row.subject || row.category || "");

  if (!subject) {
    return null;
  }

  return {
    ...row,
    subject,
    category: subject,
    subcategory: row.subcategory || getDefaultSubcategory(subject)
  };
}

async function getAllQuestions() {
  if (questionCache && questionCache.expiresAt > Date.now()) {
    return questionCache.rows;
  }

  const rows = (await loadQuestions()).flatMap((row) => {
    const normalized = normalizeQuestion(row);
    return normalized ? [normalized] : [];
  });

  questionCache = {
    rows,
    expiresAt: Date.now() + QUESTION_CACHE_TTL_MS
  };

  return rows;
}

function invalidateQuestionCache() {
  questionCache = null;
}

export async function getQuestions(filters?: { category?: ExamCategory; subject?: ExamCategory; subcategory?: ExamSubcategory | "all"; difficulty?: QuestionDifficulty }) {
  const questions = await getAllQuestions();
  const subject = filters?.subject ?? filters?.category;

  return questions.filter((question) => {
    if (subject && question.subject !== subject) {
      return false;
    }

    if (filters?.subcategory && filters.subcategory !== "all" && question.subcategory !== filters.subcategory) {
      return false;
    }

    if (filters?.difficulty && question.difficulty !== filters.difficulty) {
      return false;
    }

    return true;
  });
}

export async function appendStructuredQuestions(rows: Array<Omit<QuestionRecord, "id" | "createdAt">>) {
  const preparedRows: QuestionRecord[] = rows.map((row) => ({
    ...row,
    subject: row.subject,
    category: row.subject,
    id: createQuestionId(),
    createdAt: new Date().toISOString()
  }));

  await appendQuestions(preparedRows);
  invalidateQuestionCache();
  return preparedRows;
}

export async function getQuestionStats(): Promise<QuestionStats> {
  const questions = await getAllQuestions();

  return {
    totalQuestions: questions.length,
    byCategory: Object.fromEntries(
      EXAM_CATEGORIES.map((subject) => [subject, questions.filter((question) => question.subject === subject).length])
    ) as QuestionStats["byCategory"],
    byDifficulty: {
      easy: questions.filter((question) => question.difficulty === "easy").length,
      medium: questions.filter((question) => question.difficulty === "medium").length,
      hard: questions.filter((question) => question.difficulty === "hard").length
    }
  };
}
