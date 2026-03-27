import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";
import { getDefaultSubcategory, normalizeSubject } from "@/lib/constants";
import type { ExamResultRow, QuestionRecord, UserRecord } from "@/lib/types";

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildQuestionHash(input: {
  subject: string;
  topic: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
}) {
  const base = [
    normalizeText(input.subject).toLowerCase(),
    normalizeText(input.topic).toLowerCase(),
    normalizeText(input.question).toLowerCase(),
    [input.choice_a, input.choice_b, input.choice_c, input.choice_d]
      .map((choice) => normalizeText(choice).toLowerCase())
      .sort()
      .join("||"),
    normalizeText(input.correct_answer).toUpperCase()
  ].join("::");

  return createHash("sha256").update(base).digest("hex");
}

function mapQuestionRecord(record: Awaited<ReturnType<typeof prisma.question.findMany>>[number]): QuestionRecord {
  const subject = normalizeSubject(record.subject) ?? "Analytical Thinking";
  return {
    id: record.id,
    subject,
    category: subject,
    subcategory: (record.topic || getDefaultSubcategory(subject)) as QuestionRecord["subcategory"],
    difficulty: record.difficulty as QuestionRecord["difficulty"],
    question: record.question,
    choice_a: record.choiceA,
    choice_b: record.choiceB,
    choice_c: record.choiceC,
    choice_d: record.choiceD,
    correct_answer: record.answer as QuestionRecord["correct_answer"],
    explanation: record.explanation,
    source: record.source as QuestionRecord["source"],
    createdAt: record.createdAt.toISOString(),
    model_subcategory: record.modelSubcategory ?? undefined,
    status: record.status as QuestionRecord["status"],
    quality_score: record.qualityScore,
    topic_verified: record.topicVerified,
    no_duplicate: record.noDuplicate,
    quality_passed: record.qualityPassed,
    hash: record.hash
  };
}

function mapQuestionInput(record: QuestionRecord) {
  const subject = normalizeSubject(record.subject || record.category || "") ?? "Analytical Thinking";
  const topic = String(record.subcategory || getDefaultSubcategory(subject)).trim();
  return {
    id: record.id,
    subject,
    topic,
    question: normalizeText(record.question),
    choiceA: normalizeText(record.choice_a),
    choiceB: normalizeText(record.choice_b),
    choiceC: normalizeText(record.choice_c),
    choiceD: normalizeText(record.choice_d),
    answer: String(record.correct_answer || "A").toUpperCase(),
    explanation: normalizeText(record.explanation),
    difficulty: record.difficulty,
    hash: record.hash || buildQuestionHash({
      subject,
      topic,
      question: record.question,
      choice_a: record.choice_a,
      choice_b: record.choice_b,
      choice_c: record.choice_c,
      choice_d: record.choice_d,
      correct_answer: record.correct_answer
    }),
    source: record.source,
    status: record.status || "VALID",
    qualityScore: Number(record.quality_score || 0),
    topicVerified: Boolean(record.topic_verified),
    noDuplicate: Boolean(record.no_duplicate),
    qualityPassed: Boolean(record.quality_passed),
    modelSubcategory: record.model_subcategory || null,
    createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
  };
}

export async function loadQuestions() {
  const records = await prisma.question.findMany({ orderBy: { createdAt: "asc" } });
  return records.map(mapQuestionRecord);
}

export async function saveQuestions(rows: QuestionRecord[]) {
  const mapped = rows.map(mapQuestionInput);
  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany();
    if (mapped.length > 0) {
      await tx.question.createMany({ data: mapped });
    }
  });
}

export async function appendQuestions(rows: QuestionRecord[]) {
  if (rows.length === 0) {
    return { appended: 0, rejected: [] as Array<{ row: QuestionRecord; reason: string }> };
  }

  const existing = await prisma.question.findMany({
    where: {
      OR: [
        { id: { in: rows.map((row) => row.id) } },
        { hash: { in: rows.map((row) => mapQuestionInput(row).hash) } }
      ]
    },
    select: { id: true, hash: true, question: true }
  });

  const existingIds = new Set(existing.map((row) => row.id));
  const existingHashes = new Set(existing.map((row) => row.hash));
  const existingQuestions = new Set(existing.map((row) => normalizeText(row.question).toLowerCase()));
  const rejected: Array<{ row: QuestionRecord; reason: string }> = [];
  const accepted = [] as ReturnType<typeof mapQuestionInput>[];

  for (const row of rows) {
    const mapped = mapQuestionInput(row);
    const questionKey = normalizeText(row.question).toLowerCase();

    if (existingIds.has(mapped.id)) {
      rejected.push({ row, reason: "duplicate id" });
      continue;
    }
    if (existingHashes.has(mapped.hash) || existingQuestions.has(questionKey)) {
      rejected.push({ row, reason: "duplicate question" });
      continue;
    }

    existingIds.add(mapped.id);
    existingHashes.add(mapped.hash);
    existingQuestions.add(questionKey);
    accepted.push(mapped);
  }

  if (accepted.length > 0) {
    await prisma.question.createMany({ data: accepted });
  }

  return { appended: accepted.length, rejected };
}

export async function loadUsers(): Promise<UserRecord[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role as UserRecord["role"],
    createdAt: user.createdAt.toISOString()
  }));
}

export async function saveUsers(rows: UserRecord[]) {
  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany();
    if (rows.length > 0) {
      await tx.user.createMany({
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          passwordHash: row.passwordHash,
          role: row.role,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
        }))
      });
    }
  });
}

export async function appendUsers(rows: UserRecord[]) {
  if (rows.length === 0) return;
  await prisma.user.createMany({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
    }))
  });
}

export async function loadHistory(): Promise<ExamResultRow[]> {
  const history = await prisma.examHistory.findMany({ orderBy: { createdAt: "asc" } });
  return history.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    subject: (normalizeSubject(entry.subject) ?? "Analytical Thinking") as ExamResultRow["subject"],
    category: (normalizeSubject(entry.subject) ?? "Analytical Thinking") as ExamResultRow["category"],
    subcategory: (entry.topic || "all") as ExamResultRow["subcategory"],
    totalQuestions: entry.totalQuestions,
    correctCount: entry.correctCount,
    wrongCount: entry.wrongCount,
    score: entry.score,
    durationSeconds: entry.durationSeconds,
    createdAt: entry.createdAt.toISOString()
  }));
}

export async function saveHistory(rows: ExamResultRow[]) {
  await prisma.$transaction(async (tx) => {
    await tx.examHistory.deleteMany();
    if (rows.length > 0) {
      await tx.examHistory.createMany({
        data: rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          subject: row.subject,
          topic: row.subcategory && row.subcategory !== "all" ? row.subcategory : null,
          totalQuestions: row.totalQuestions,
          correctCount: row.correctCount,
          wrongCount: row.wrongCount,
          score: row.score,
          durationSeconds: row.durationSeconds,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
        }))
      });
    }
  });
}

export async function appendHistory(rows: ExamResultRow[]) {
  if (rows.length === 0) return;
  await prisma.examHistory.createMany({
    data: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      subject: row.subject,
      topic: row.subcategory && row.subcategory !== "all" ? row.subcategory : null,
      totalQuestions: row.totalQuestions,
      correctCount: row.correctCount,
      wrongCount: row.wrongCount,
      score: row.score,
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
    }))
  });
}

export { buildQuestionHash };