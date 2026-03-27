import { callPythonAi } from "@/services/python-engine-client";

type GeneratorInput = {
  category: string;
  subcategory: string;
  count: number;
  difficulty: string;
  offset?: number;
};

type GeneratedRow = {
  subject: string;
  category: string;
  subcategory: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  source: string;
  generation_mode?: string;
};

export async function generateWithPythonEngine(input: GeneratorInput): Promise<GeneratedRow[]> {
  const response = await callPythonAi("/generate", "generate", input);
  const questions = Array.isArray(response?.questions) ? response.questions : Array.isArray(response) ? response : [];
  if (questions.length === 0) {
    throw new Error("Python AI engine returned no questions");
  }

  return questions.map((question: any) => ({
    ...question,
    subject: String(question.subject || input.category),
    category: String(question.category || input.category),
    subcategory: String(question.subcategory || input.subcategory),
    difficulty: String(question.difficulty || input.difficulty),
    source: String(question.source || "python-rule")
  })) as GeneratedRow[];
}
