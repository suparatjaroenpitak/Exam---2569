import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import path from "path";
import { env } from "@/lib/env";

const DATA_DIR = path.isAbsolute(env.dataDir) ? env.dataDir : path.resolve(process.cwd(), env.dataDir);
const questionsFilePath = path.join(DATA_DIR, "questions.xlsx");
const questionsBackupFilePath = path.join(DATA_DIR, "questions_backup.xlsx");

let started = false;
export function startBackupScheduler(intervalMs = 5 * 60 * 1000) {
  if (started) return;
  started = true;

  async function job() {
    try {
      if (existsSync(questionsFilePath)) {
        await copyFile(questionsFilePath, questionsBackupFilePath);
      }
    } catch (err) {
      console.warn("backup-scheduler: failed to copy questions file:", err);
    }
  }

  // run immediately and then on interval
  job();
  setInterval(job, intervalMs).unref && setInterval(job, intervalMs).unref();
}

// start automatically when module is imported in server environment
try {
  startBackupScheduler();
} catch (err) {
  // ignore in non-serverless contexts
}
