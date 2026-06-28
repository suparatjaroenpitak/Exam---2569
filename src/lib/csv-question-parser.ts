import { parse } from "csv-parse/sync";
import { normalizeSubject, getDefaultSubcategory } from "@/lib/constants";
import { classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function parseCsvQuestions(buffer: Buffer): Array<Omit<QuestionRecord, "id" | "createdAt">> {
  const raw = buffer.toString("utf-8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });
  const seen = new Set<string>();
  const rows: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];

  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const row = record as Record<string, string>;

    const question = normalizeText(
      row.question || row.Question || row.คำถาม || row.โจทย์ || row.ข้อ || row.stem || row.Stem || ""
    );
    if (!question || question.length < 5) continue;

    const choice_a = normalizeText(row.choice_a || row.choice_A || row.Choice_A || row.choice1 || row.choice_1 || row.ก || row.ตัวเลือก1 || "");
    const choice_b = normalizeText(row.choice_b || row.choice_B || row.Choice_B || row.choice2 || row.choice_2 || row.ข || row.ตัวเลือก2 || "");
    const choice_c = normalizeText(row.choice_c || row.choice_C || row.Choice_C || row.choice3 || row.choice_3 || row.ค || row.ตัวเลือก3 || "");
    const choice_d = normalizeText(row.choice_d || row.choice_D || row.Choice_D || row.choice4 || row.choice_4 || row.ง || row.ตัวเลือก4 || "");

    const availableChoices = [choice_a, choice_b, choice_c, choice_d].filter(Boolean);
    if (availableChoices.length < 2) continue;

    const rawAnswer = normalizeText(
      row.correct_answer || row.correctAnswer || row.answer || row.Answer || row.Correct_Answer
        || row.เฉลย || row.คำตอบ || row.เฉลยข้อ || ""
    );
    let correctAnswer: AnswerKey = "A";
    if (/^[A-Da-d]$/.test(rawAnswer)) {
      correctAnswer = rawAnswer.toUpperCase() as AnswerKey;
    } else if (rawAnswer) {
      const matchIdx = availableChoices.findIndex((c) => c.toLowerCase() === rawAnswer.toLowerCase());
      if (matchIdx >= 0) {
        correctAnswer = (["A", "B", "C", "D"] as const)[matchIdx];
      }
    }

    const explanation = normalizeText(
      row.explanation || row.Explanation || row.เฉลยละเอียด || row.คำอธิบาย || row.เหตุผล || ""
    );
    const rawSubject = normalizeText(row.subject || row.Subject || row.วิชา || row.หมวด || row.category || row.Category || "");
    const rawSubcategory = normalizeText(row.subcategory || row.Subcategory || row.topic || row.Topic
      || row.หมวดย่อย || row.หัวข้อ || "");

    const combinedText = `${question}\n${availableChoices.join("\n")}`;
    const classification = classifyByKeywords(combinedText);
    const subject = (normalizeSubject(rawSubject) ?? classification.subject ?? "Analytical Thinking") as ExamCategory;
    const subcategory = (rawSubcategory || classification.subcategory || getDefaultSubcategory(subject)) as ExamSubcategory;
    const difficulty = (row.difficulty || row.Difficulty || row.ระดับ || row.ความยาก
      ? normalizeText(row.difficulty || row.Difficulty || row.ระดับ || row.ความยาก).toLowerCase()
      : estimateDifficulty(question)) as QuestionDifficulty;

    const choices = [choice_a, choice_b, choice_c, choice_d];
    while (choices.length < 4) choices.push("");

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
      explanation,
      source: "pdf"
    });
  }

  return rows;
}
