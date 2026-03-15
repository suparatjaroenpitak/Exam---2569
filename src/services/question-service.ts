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

function buildQuestionFingerprint(
  row: Pick<QuestionRecord, "question" | "choice_a" | "choice_b" | "choice_c" | "choice_d" | "correct_answer">
) {
  // Use question text, sorted choice texts, and the correct answer text to create
  // a fingerprint that is stable regardless of choice ordering. This prevents
  // duplicates when generators shuffle choices.
  const q = String(row.question).replace(/\s+/g, " ").trim().toLowerCase();
  const choices = [row.choice_a, row.choice_b, row.choice_c, row.choice_d].map((c) =>
    String(c).replace(/\s+/g, " ").trim().toLowerCase()
  );
  const sortedChoices = choices.slice().sort();
  // Map correct_answer key (A/B/C/D) to the correct choice text; if missing, leave empty
  const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const keyIndex = keyMap[String(row.correct_answer) || ""]; 
  const correctText = typeof keyIndex === "number" && choices[keyIndex] ? choices[keyIndex] : "";

  return [q, sortedChoices.join("||"), correctText].join("||");
}

function buildQuestionStemFingerprint(
  row: Pick<QuestionRecord, "subject" | "subcategory" | "question">
) {
  const subject = String(row.subject).replace(/\s+/g, " ").trim().toLowerCase();
  const subcategory = String(row.subcategory || "").replace(/\s+/g, " ").trim().toLowerCase();
  const question = String(row.question).replace(/\s+/g, " ").trim().toLowerCase();

  return [subject, subcategory, question].join("||");
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
  const existing = await getAllQuestions();
  const existingFingerprints = new Set(existing.map((row) => buildQuestionFingerprint(row)));
  const existingStemFingerprints = new Set(existing.map((row) => buildQuestionStemFingerprint(row)));
  const incomingFingerprints = new Set<string>();
  const incomingStemFingerprints = new Set<string>();

  const preparedRows: QuestionRecord[] = rows
    .filter((row) => {
      const fingerprint = buildQuestionFingerprint({
        question: row.question,
        choice_a: row.choice_a,
        choice_b: row.choice_b,
        choice_c: row.choice_c,
        choice_d: row.choice_d,
        correct_answer: row.correct_answer
      });
      const stemFingerprint = buildQuestionStemFingerprint({
        subject: row.subject,
        subcategory: row.subcategory || getDefaultSubcategory(row.subject),
        question: row.question
      });

      if (
        existingFingerprints.has(fingerprint)
        || incomingFingerprints.has(fingerprint)
        || existingStemFingerprints.has(stemFingerprint)
        || incomingStemFingerprints.has(stemFingerprint)
      ) {
        return false;
      }

      incomingFingerprints.add(fingerprint);
      incomingStemFingerprints.add(stemFingerprint);
      return true;
    })
    .map((row) => ({
      ...row,
      subject: row.subject,
      category: row.subject,
      subcategory: row.subcategory || getDefaultSubcategory(row.subject),
      difficulty: row.difficulty || ("medium" as any),
      id: createQuestionId(),
      createdAt: new Date().toISOString()
    }));

  if (preparedRows.length === 0) {
    return [];
  }

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
