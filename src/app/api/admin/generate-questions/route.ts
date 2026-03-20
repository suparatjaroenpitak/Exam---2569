import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import type { ExamSubcategory } from "@/lib/types";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { generateAndSave } from "@/services/generation-pipeline";

const generateSchema = z.object({
  category: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2),
  count: z.number().int().min(1).max(100),
  difficulty: z.enum(DIFFICULTY_OPTIONS)
});

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
    const result = await generateAndSave({ ...payload, subcategory: payload.subcategory as ExamSubcategory });
    const message = result.fallbackUsed
      ? `Using fallback questions; saved ${result.saved}, rejected ${result.rejected}`
      : `Generated ${result.generated}, saved ${result.saved}, rejected ${result.rejected}`;

    return NextResponse.json({
      message,
      generated: result.generated,
      saved: result.saved,
      rejected: result.rejected,
      totalQuestions: result.totalAfter,
      fallbackUsed: Boolean(result.fallbackUsed)
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "NLP generation failed" },
      { status: 400 }
    );
  }
}
