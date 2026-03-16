import { existsSync } from "fs";
import { mkdir, writeFile, copyFile } from "fs/promises";
import path from "path";

import * as XLSX from "xlsx";

import { EXCEL_SHEETS } from "@/lib/constants";
import { env } from "@/lib/env";
import { startBackupScheduler } from "@/lib/backup-scheduler";
import type { ExamResultRow, QuestionRecord, UserRecord } from "@/lib/types";

const DATA_DIR = path.isAbsolute(env.dataDir) ? env.dataDir : path.resolve(process.cwd(), env.dataDir);
const questionsFilePath = path.join(DATA_DIR, "questions.xlsx");
const usersFilePath = path.join(DATA_DIR, "users.xlsx");
const historyFilePath = path.join(DATA_DIR, "history.xlsx");
const questionsBackupFilePath = path.join(DATA_DIR, "questions_backup.xlsx");

const questionHeaders: Array<keyof QuestionRecord> = [
  "id",
  "subject",
  "category",
  "subcategory",
  "difficulty",
  "question",
  "choice_a",
  "choice_b",
  "choice_c",
  "choice_d",
  "correct_answer",
  "explanation",
  "source",
  "createdAt"
];

// start the background backup scheduler (safe no-op if already started)
startBackupScheduler();

const userHeaders: Array<keyof UserRecord> = ["id", "name", "email", "passwordHash", "role", "createdAt"];
const historyHeaders: Array<keyof ExamResultRow> = [
  "id",
  "userId",
  "subject",
  "category",
  "subcategory",
  "totalQuestions",
  "correctCount",
  "wrongCount",
  "score",
  "durationSeconds",
  "createdAt"
];

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function ensureWorkbook<T extends object>(filePath: string, sheetName: string, headers: Array<keyof T>) {
  await ensureDir();

  if (existsSync(filePath)) {
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([], { header: headers as string[] });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFile(filePath, buffer);
}

async function readRows<T extends object>(filePath: string, sheetName: string, headers: Array<keyof T>): Promise<T[]> {
  await ensureWorkbook<T>(filePath, sheetName, headers);
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<T>(worksheet, { defval: "" });
}

async function writeRows<T extends object>(filePath: string, sheetName: string, rows: T[], headers: Array<keyof T>) {
  await ensureDir();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers as string[] });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFile(filePath, buffer);
}

async function backupFile(filePath: string, backupPath: string) {
  try {
    if (existsSync(filePath)) {
      // always overwrite the single backup file atomically
      await copyFile(filePath, backupPath);
    }
  } catch (err) {
    // best-effort backup, do not throw to avoid breaking import flow
    console.warn("Failed to create backup:", err);
  }
}

async function appendRowsAtomic<T extends object>(filePath: string, sheetName: string, rows: T[], headers: Array<keyof T>) {
  await ensureDir();
  await ensureWorkbook<T>(filePath, sheetName, headers);

  // create a backup before modifying
  await backupFile(filePath, questionsBackupFilePath);

  const workbook = XLSX.readFile(filePath);
  let worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    worksheet = XLSX.utils.json_to_sheet([], { header: headers as string[] });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Append rows to existing worksheet without replacing header
  XLSX.utils.sheet_add_json(worksheet, rows as any[], { origin: -1, skipHeader: true });

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFile(filePath, buffer);
}

export async function loadQuestions() {
  return readRows<QuestionRecord>(questionsFilePath, EXCEL_SHEETS.questions, questionHeaders);
}

export async function saveQuestions(rows: QuestionRecord[]) {
  await writeRows<QuestionRecord>(questionsFilePath, EXCEL_SHEETS.questions, rows, questionHeaders);
}

import { validateStrictQuestion, mapSubjectToStrict } from "@/lib/question-validator";
export async function appendQuestions(rows: QuestionRecord[]) {
  const existing = await loadQuestions();

  const existingIds = new Set(existing.map((r) => String(r.id).trim()));
  const existingTexts = new Set(existing.map((r) => String(r.question || "").replace(/\s+/g, " ").trim().toLowerCase()));

  const toAppend: any[] = [];
  const rejected: Array<{ row: any; reason: string }> = [];

  for (const r of rows) {
    try {
      const id = r.id && typeof r.id === "string" ? r.id : (globalThis.crypto && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()));
      if (existingIds.has(id)) {
        rejected.push({ row: r, reason: "duplicate id" });
        continue;
      }

      const textKey = String(r.question || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (existingTexts.has(textKey)) {
        rejected.push({ row: r, reason: "duplicate question text" });
        continue;
      }

      const strict = {
        id,
        subject: mapSubjectToStrict(String(r.subject || r.category || "")),
        subcategory: String(r.subcategory || "").trim() || String(r.category || "").trim() || "",
        question: String(r.question || "").trim(),
        choice_a: String(r.choice_a || "").trim(),
        choice_b: String(r.choice_b || "").trim(),
        choice_c: String(r.choice_c || "").trim(),
        choice_d: String(r.choice_d || "").trim(),
        correct_answer: String((r.correct_answer || "") as any).toUpperCase() as any,
        explanation: String(r.explanation || "").trim(),
        difficulty: (r.difficulty || "medium") as any,
        source: (r.source === "llm" || r.source === "nlp") ? "ai" : "pdf",
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const v = validateStrictQuestion({
        id: strict.id,
        subject: strict.subject,
        subcategory: strict.subcategory,
        question: strict.question,
        choice_a: strict.choice_a,
        choice_b: strict.choice_b,
        choice_c: strict.choice_c,
        choice_d: strict.choice_d,
        correct_answer: strict.correct_answer,
        explanation: strict.explanation,
        difficulty: strict.difficulty,
        source: strict.source,
        created_at: strict.created_at
      });

      if (!v.valid) {
        rejected.push({ row: r, reason: String(v.reason || "validation failed") });
        continue;
      }

      toAppend.push({
        id: strict.id,
        subject: strict.subject,
        category: r.category ?? r.subject,
        subcategory: strict.subcategory,
        difficulty: strict.difficulty,
        question: strict.question,
        choice_a: strict.choice_a,
        choice_b: strict.choice_b,
        choice_c: strict.choice_c,
        choice_d: strict.choice_d,
        correct_answer: strict.correct_answer,
        explanation: strict.explanation,
        source: strict.source,
        createdAt: strict.createdAt,
        created_at: strict.created_at
      });

      existingIds.add(id);
      existingTexts.add(textKey);
    } catch (err) {
      rejected.push({ row: r, reason: String(err) });
    }
  }

  if (toAppend.length > 0) {
    // append without rewriting the entire sheet
    await appendRowsAtomic<QuestionRecord>(questionsFilePath, EXCEL_SHEETS.questions, toAppend as any[], questionHeaders as any[]);
  }

  return { appended: toAppend.length, rejected };
}

export async function loadUsers() {
  return readRows<UserRecord>(usersFilePath, EXCEL_SHEETS.users, userHeaders);
}

export async function saveUsers(rows: UserRecord[]) {
  await writeRows<UserRecord>(usersFilePath, EXCEL_SHEETS.users, rows, userHeaders);
}

export async function appendUsers(rows: UserRecord[]) {
  const existing = await loadUsers();
  await saveUsers([...existing, ...rows]);
}

export async function loadHistory() {
  return readRows<ExamResultRow>(historyFilePath, EXCEL_SHEETS.history, historyHeaders);
}

export async function saveHistory(rows: ExamResultRow[]) {
  await writeRows<ExamResultRow>(historyFilePath, EXCEL_SHEETS.history, rows, historyHeaders);
}

export async function appendHistory(rows: ExamResultRow[]) {
  const existing = await loadHistory();
  await saveHistory([...existing, ...rows]);
}
