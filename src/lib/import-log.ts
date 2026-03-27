import path from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const importLogPath = path.join(LOG_DIR, "import_log.json");

async function ensureDir() {
  await mkdir(LOG_DIR, { recursive: true });
}

export async function appendImportLog(entry: Record<string, unknown>) {
  await ensureDir();
  let logs: any[] = [];
  try {
    if (existsSync(importLogPath)) {
      const raw = await readFile(importLogPath, "utf8");
      logs = JSON.parse(raw || "[]");
    }
  } catch (err) {
    logs = [];
  }

  logs.push(entry);
  await writeFile(importLogPath, JSON.stringify(logs, null, 2), "utf8");
}

export async function readImportLog() {
  await ensureDir();
  try {
    if (existsSync(importLogPath)) {
      const raw = await readFile(importLogPath, "utf8");
      return JSON.parse(raw || "[]");
    }
  } catch (e) {}
  return [];
}
