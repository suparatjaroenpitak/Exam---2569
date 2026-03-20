import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import type { ExamSubcategory } from "@/lib/types";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { generateAndSave } from "@/services/generation-pipeline";
import { createGenerationJob, getGenerationJob, updateGenerationJob } from "@/services/generation-job-store";

const generateSchema = z.object({
  category: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2),
  count: z.number().int().min(1).max(100),
  difficulty: z.enum(DIFFICULTY_OPTIONS)
});

export async function GET(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ message: "Missing jobId" }, { status: 400 });
  }

  const job = getGenerationJob(jobId);
  if (!job) {
    return NextResponse.json({ message: "Generation job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    const payload = generateSchema.parse(await request.json());

    if (!SUBJECT_SUBCATEGORIES[payload.category].includes(payload.subcategory as (typeof SUBJECT_SUBCATEGORIES)[typeof payload.category][number])) {
      return NextResponse.json({ message: "Invalid subcategory for selected subject" }, { status: 400 });
    }
    const job = createGenerationJob({
      state: "running",
      progress: 5,
      stage: "queued",
      message: "Starting generation"
    });

    void (async () => {
      try {
        const result = await generateAndSave({
          ...payload,
          subcategory: payload.subcategory as ExamSubcategory,
          onProgress: ({ progress, stage, message }) => {
            updateGenerationJob(job.id, { progress, stage, message, state: stage === "completed" ? "completed" : "running" });
          }
        });
        const message = `Cleared ${result.clearedAi} old AI questions; saved ${result.saved}/${result.requested}, rejected ${result.rejected}`;
        updateGenerationJob(job.id, {
          state: "completed",
          progress: 100,
          stage: "completed",
          message,
          result: {
            message,
            generated: result.generated,
            saved: result.saved,
            rejected: result.rejected,
            clearedAi: result.clearedAi,
            requested: result.requested,
            completionPercent: result.completionPercent,
            totalQuestions: result.totalAfter,
            fallbackUsed: Boolean(result.fallbackUsed)
          }
        });
      } catch (error) {
        updateGenerationJob(job.id, {
          state: "failed",
          stage: "failed",
          message: error instanceof Error ? error.message : "NLP generation failed",
          error: error instanceof Error ? error.message : "NLP generation failed"
        });
      }
    })();

    return NextResponse.json({ jobId: job.id, accepted: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "NLP generation failed" },
      { status: 400 }
    );
  }
}
