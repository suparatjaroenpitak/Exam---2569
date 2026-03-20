import path from "path";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import * as XLSX from "xlsx";
import { env } from "@/lib/env";

const DATA_DIR = path.isAbsolute(env.dataDir) ? env.dataDir : path.resolve(process.cwd(), env.dataDir);
const generationLogPath = path.join(DATA_DIR, "generation_logs.xlsx");

const generationLogHeaders = ["timestamp", "generated", "valid", "saved", "failed", "fallbackUsed"];

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function ensureWorkbook() {
  await ensureDir();
  if (existsSync(generationLogPath)) return;
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([], { header: generationLogHeaders });
  XLSX.utils.book_append_sheet(workbook, worksheet, "logs");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFile(generationLogPath, buffer);
}

async function readLogs() {
  await ensureWorkbook();
  const workbook = XLSX.readFile(generationLogPath);
  const worksheet = workbook.Sheets["logs"];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });
}

async function writeLogs(rows: any[]) {
  await ensureDir();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: generationLogHeaders });
  XLSX.utils.book_append_sheet(workbook, worksheet, "logs");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFile(generationLogPath, buffer);
}

export async function appendGenerationLog(entry: { timestamp: string; generated: number; valid: number; saved: number; failed: number; fallbackUsed?: boolean }) {
  const existing = await readLogs();
  existing.push({ ...entry, fallbackUsed: Boolean(entry.fallbackUsed) });
  await writeLogs(existing);
}

export async function readGenerationLogs() {
  return await readLogs();
}
