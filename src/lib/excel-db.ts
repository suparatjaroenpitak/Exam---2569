import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import * as XLSX from "xlsx";

import { EXCEL_SHEETS } from "@/lib/constants";
import { env } from "@/lib/env";
import type { ExamResultRow, QuestionRecord, UserRecord } from "@/lib/types";

const DATA_DIR = path.isAbsolute(env.dataDir) ? env.dataDir : path.resolve(process.cwd(), env.dataDir);
const questionsFilePath = path.join(DATA_DIR, "questions.xlsx");
const usersFilePath = path.join(DATA_DIR, "users.xlsx");
const historyFilePath = path.join(DATA_DIR, "history.xlsx");

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

export async function loadQuestions() {
  return readRows<QuestionRecord>(questionsFilePath, EXCEL_SHEETS.questions, questionHeaders);
}

export async function saveQuestions(rows: QuestionRecord[]) {
  await writeRows<QuestionRecord>(questionsFilePath, EXCEL_SHEETS.questions, rows, questionHeaders);
}

export async function appendQuestions(rows: QuestionRecord[]) {
  const existing = await loadQuestions();
  await saveQuestions([...existing, ...rows]);
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
