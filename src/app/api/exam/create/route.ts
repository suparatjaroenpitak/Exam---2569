import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-guards";
import { EXAM_CATEGORIES, EXAM_LENGTH_OPTIONS, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { createExamSession } from "@/services/exam-service";

const createExamSchema = z.object({
  category: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().optional(),
  count: z.number().int().refine((value) => EXAM_LENGTH_OPTIONS.includes(value as (typeof EXAM_LENGTH_OPTIONS)[number]), {
    message: "Invalid question count"
  }),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional()
});

export async function POST(request: NextRequest) {
  const guard = await requireApiUser(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    const payload = createExamSchema.parse(await request.json());

    if (payload.subcategory && payload.subcategory !== "all" && !SUBJECT_SUBCATEGORIES[payload.category].includes(payload.subcategory as (typeof SUBJECT_SUBCATEGORIES)[typeof payload.category][number])) {
      return NextResponse.json({ message: "Invalid subcategory for selected subject" }, { status: 400 });
    }

    const session = await createExamSession({
      category: payload.category,
      subcategory: payload.subcategory as Parameters<typeof createExamSession>[0]["subcategory"],
      count: payload.count,
      difficulty: payload.difficulty
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create exam" },
      { status: 400 }
    );
  }
}
