import path from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const generationLogPath = path.join(LOG_DIR, "generation.json");

export type GenerationLogEntry = {
  timestamp: string;
  topic: string;
  generated: number;
  saved: number;
  rejected: number;
  fallbackUsed?: boolean;
  qualityThreshold?: number;
};

async function ensureDir() {
  await mkdir(LOG_DIR, { recursive: true });
}

async function readLogs() {
  await ensureDir();
  if (!existsSync(generationLogPath)) {
    return [] as GenerationLogEntry[];
  }

  try {
    const raw = await readFile(generationLogPath, "utf8");
    return JSON.parse(raw || "[]") as GenerationLogEntry[];
  } catch {
    return [] as GenerationLogEntry[];
  }
}

export async function appendGenerationLog(entry: GenerationLogEntry) {
  const existing = await readLogs();
  existing.push(entry);
  await writeFile(generationLogPath, JSON.stringify(existing, null, 2), "utf8");
}

export async function readGenerationLogs() {
  return readLogs();
}
