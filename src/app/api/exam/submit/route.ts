import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { gradeExamAttempt } from "@/services/exam-service";

const submitExamSchema = z.object({
  category: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().optional(),
  questionIds: z.array(z.string()).min(1),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedKey: z.enum(["A", "B", "C", "D"]).nullable()
    })
  ),
  durationSeconds: z.number().int().min(0)
});

export async function POST(request: NextRequest) {
  const guard = await requireApiUser(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    const payload = submitExamSchema.parse(await request.json());

    if (payload.subcategory && payload.subcategory !== "all" && !SUBJECT_SUBCATEGORIES[payload.category].includes(payload.subcategory as (typeof SUBJECT_SUBCATEGORIES)[typeof payload.category][number])) {
      return NextResponse.json({ message: "Invalid subcategory for selected subject" }, { status: 400 });
    }

    const summary = await gradeExamAttempt({
      userId: guard.user.id,
      category: payload.category,
      subcategory: payload.subcategory as Parameters<typeof gradeExamAttempt>[0]["subcategory"],
      questionIds: payload.questionIds,
      answers: payload.answers,
      durationSeconds: payload.durationSeconds
    });
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to submit exam" },
      { status: 400 }
    );
  }
}
