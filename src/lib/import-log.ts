import path from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { env } from "@/lib/env";

const DATA_DIR = path.isAbsolute(env.dataDir) ? env.dataDir : path.resolve(process.cwd(), env.dataDir);
const importLogPath = path.join(DATA_DIR, "import_log.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
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
