import mammoth from "mammoth";
import { splitPdfIntoQuestionCandidates, parseCandidate, classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import { normalizeSubject, getDefaultSubcategory } from "@/lib/constants";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

export async function parseWordQuestions(buffer: Buffer): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) return [];

  const candidates = splitPdfIntoQuestionCandidates(text);
  const seen = new Set<string>();
  const rows: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (!parsed.question || parsed.choices.length < 2) continue;

    const question = parsed.question;
    const choices = parsed.choices;
    while (choices.length < 4) choices.push("");
    const combinedText = `${question}\n${choices.join("\n")}`;
    const classification = classifyByKeywords(combinedText);
    const subject = (normalizeSubject(classification.subject) ?? "Analytical Thinking") as ExamCategory;
    const subcategory = (classification.subcategory ?? getDefaultSubcategory(subject)) as ExamSubcategory;
    const difficulty = estimateDifficulty(question) as QuestionDifficulty;

    const correctAnswer: AnswerKey = parsed.correct_answer && /^[A-D]$/i.test(parsed.correct_answer)
      ? parsed.correct_answer.toUpperCase() as AnswerKey
      : "A";

    const fp = [question.toLowerCase(), choices.filter(Boolean).slice().sort().join("||")].join("||");
    if (seen.has(fp)) continue;
    seen.add(fp);

    rows.push({
      subject,
      category: subject,
      subcategory,
      difficulty,
      question,
      choice_a: choices[0] ?? "",
      choice_b: choices[1] ?? "",
      choice_c: choices[2] ?? "",
      choice_d: choices[3] ?? "",
      correct_answer: correctAnswer,
      explanation: parsed.correct_answer ? "Imported from Word document" : "Imported from Word document; no explicit answer key found",
      source: "pdf"
    });
  }

  return rows;
}
