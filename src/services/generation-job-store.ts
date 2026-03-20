import { randomUUID } from "crypto";

type GenerationJobState = "queued" | "running" | "completed" | "failed";

export type GenerationJobSnapshot = {
  id: string;
  state: GenerationJobState;
  progress: number;
  stage: string;
  message: string;
  createdAt: number;
  updatedAt: number;
  result?: Record<string, unknown>;
  error?: string;
};

const jobs = new Map<string, GenerationJobSnapshot>();
const JOB_TTL_MS = 15 * 60 * 1000;

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

export function createGenerationJob(initial?: Partial<GenerationJobSnapshot>) {
  cleanupExpiredJobs();
  const now = Date.now();
  const job: GenerationJobSnapshot = {
    id: randomUUID(),
    state: "queued",
    progress: 2,
    stage: "queued",
    message: "Queued",
    createdAt: now,
    updatedAt: now,
    ...initial
  };
  jobs.set(job.id, job);
  return job;
}

export function updateGenerationJob(id: string, patch: Partial<GenerationJobSnapshot>) {
  const existing = jobs.get(id);
  if (!existing) {
    return null;
  }
  const next = {
    ...existing,
    ...patch,
    updatedAt: Date.now()
  };
  jobs.set(id, next);
  return next;
}

export function getGenerationJob(id: string) {
  cleanupExpiredJobs();
  return jobs.get(id) ?? null;
}