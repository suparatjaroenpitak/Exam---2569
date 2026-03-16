import { z } from "zod";

export const StrictQuestionSchema = z.object({
  id: z.string().uuid(),
  subject: z.enum(["math", "thai", "english", "law"]),
  subcategory: z.string(),
  question: z.string().min(10),
  choice_a: z.string().min(1),
  choice_b: z.string().min(1),
  choice_c: z.string().min(1),
  choice_d: z.string().min(1),
  correct_answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  source: z.enum(["pdf", "ai"]),
  created_at: z.string()
});

export type StrictQuestion = z.infer<typeof StrictQuestionSchema>;

export function validateStrictQuestion(obj: unknown) {
  try {
    const parsed = StrictQuestionSchema.parse(obj);
    return { valid: true as const, parsed };
  } catch (err: any) {
    return { valid: false as const, reason: err?.message ?? String(err) };
  }
}

export function isPdfCandidateValidText(raw: string) {
  // must contain a numbered question line starting with digits and a dot
  const hasNumbered = /\d+\./m.test(raw);
  // must contain A. B. C. D. markers
  const hasChoices = /\bA\.|\bB\.|\bC\.|\bD\./.test(raw);

  return { hasNumbered, hasChoices };
}

// map the project's broader subject names to strict short codes
export function mapSubjectToStrict(subject: string) {
  const s = String(subject || "").toLowerCase();
  if (s.includes("analytical") || s.includes("math") || s.includes("analytic")) return "math";
  if (s.includes("thai")) return "thai";
  if (s.includes("english")) return "english";
  return "law"; // default to law for government/law categories
}
