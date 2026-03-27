import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES, DIFFICULTY_OPTIONS } from "@/lib/constants";
import { generateAndSave } from "@/services/generation-pipeline";
import { getQuestions } from "@/services/question-service";

const generateSchema = z.object({
  subject: z.enum(EXAM_CATEGORIES),
  topic: z.string().min(2),
  difficulty: z.enum(DIFFICULTY_OPTIONS),
  count: z.number().int().min(1).max(50)
});

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);
  if (guard.error) {
    return guard.error;
  }

  try {
    const payload = generateSchema.parse(await request.json());
    if (!SUBJECT_SUBCATEGORIES[payload.subject].includes(payload.topic as any)) {
      return NextResponse.json({ message: "Invalid topic for selected subject" }, { status: 400 });
    }

    const result = await generateAndSave({
      category: payload.subject,
      subcategory: payload.topic,
      difficulty: payload.difficulty,
      count: payload.count
    });

    const questions = await getQuestions({
      subject: payload.subject,
      subcategory: payload.topic as any,
      difficulty: payload.difficulty
    });

    return NextResponse.json({
      generated: result.generated,
      saved: result.saved,
      rejected: result.rejected,
      questions: questions.slice(-Math.max(result.saved, 1)),
      fallbackUsed: result.fallbackUsed
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to generate questions" }, { status: 400 });
  }
}