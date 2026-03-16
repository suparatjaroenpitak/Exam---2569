import { classifyQuestion } from "@/services/wangchan-nlp-service";

export async function aiValidateQuestion(payload: {
  question: string;
  choices: string[];
  correct?: string | null;
}) {
  // Send to local classifier for subject/subcategory check
  const classified = await classifyQuestion(`${payload.question}\n${payload.choices.join("\n")}`);

  const isReal = payload.question && payload.question.trim().length >= 10;
  const hasFour = Array.isArray(payload.choices) && payload.choices.length === 4 && payload.choices.every((c) => String(c).trim().length > 0);
  const correctValid = typeof payload.correct === "string" && /^[A-D]$/i.test(payload.correct);

  return {
    valid: !!(isReal && hasFour && correctValid),
    reasons: {
      isReal: !!isReal,
      hasFour,
      correctValid
    },
    subject: classified.subject,
    subcategory: classified.subcategory
  };
}
