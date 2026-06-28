import * as XLSX from "xlsx";
import { normalizeSubject, getDefaultSubcategory } from "@/lib/constants";
import { classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function mapColumnName(name: string): string {
  const lower = name.toLowerCase().replace(/[\s_-]/g, "");
  const map: Record<string, string> = {
    question: "question",
    คำถาม: "question",
    โจทย์: "question",
    ข้อ: "question",
    choicea: "choice_a",
    choice1: "choice_a",
    choice_1: "choice_a",
    ชอยส์1: "choice_a",
    ตัวเลือก1: "choice_a",
    ก: "choice_a",
    choiceb: "choice_b",
    choice2: "choice_b",
    choice_2: "choice_b",
    ชอยส์2: "choice_b",
    ตัวเลือก2: "choice_b",
    ข: "choice_b",
    choicec: "choice_c",
    choice3: "choice_c",
    choice_3: "choice_c",
    ชอยส์3: "choice_c",
    ตัวเลือก3: "choice_c",
    ค: "choice_c",
    choiced: "choice_d",
    choice4: "choice_d",
    choice_4: "choice_d",
    ชอยส์4: "choice_d",
    ตัวเลือก4: "choice_d",
    ง: "choice_d",
    answer: "correct_answer",
    correct: "correct_answer",
    correctanswer: "correct_answer",
    correct_answer: "correct_answer",
    เฉลย: "correct_answer",
    คำตอบ: "correct_answer",
    explanation: "explanation",
    เฉลยละเอียด: "explanation",
    คำอธิบาย: "explanation",
    เหตุผล: "explanation",
    subject: "subject",
    วิชา: "subject",
    หมวด: "subject",
    category: "subject",
    topic: "subcategory",
    subcategory: "subcategory",
    หมวดย่อย: "subcategory",
    หัวข้อ: "subcategory",
    difficulty: "difficulty",
    ระดับ: "difficulty",
    ความยาก: "difficulty"
  };
  return map[lower] ?? name;
}

export function parseExcelQuestions(buffer: Buffer): Array<Omit<QuestionRecord, "id" | "createdAt">> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const results: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];
  const seen = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0] || {});
    const columns = headers.map((h) => ({ original: h, mapped: mapColumnName(h) }));

    function getCol(mappedName: string): string | null {
      const col = columns.find((c) => c.mapped === mappedName);
      return col ? col.original : null;
    }

    for (const row of rows) {
      const qCol = getCol("question");
      if (!qCol) continue;
      const question = normalizeText(row[qCol]);
      if (!question || question.length < 5) continue;

      const choice_a = normalizeText(row[getCol("choice_a") ?? ""] ?? "");
      const choice_b = normalizeText(row[getCol("choice_b") ?? ""] ?? "");
      const choice_c = normalizeText(row[getCol("choice_c") ?? ""] ?? "");
      const choice_d = normalizeText(row[getCol("choice_d") ?? ""] ?? "");

      const availableChoices = [choice_a, choice_b, choice_c, choice_d].filter(Boolean);
      if (availableChoices.length < 2) continue;

      const rawAnswer = normalizeText(row[getCol("correct_answer") ?? ""] ?? "");
      let correctAnswer: AnswerKey = "A";
      if (/^[A-Da-d]$/.test(rawAnswer)) {
        correctAnswer = rawAnswer.toUpperCase() as AnswerKey;
      } else if (rawAnswer) {
        const matchIdx = availableChoices.findIndex((c) => c.toLowerCase() === rawAnswer.toLowerCase());
        if (matchIdx >= 0) {
          correctAnswer = (["A", "B", "C", "D"] as const)[matchIdx];
        }
      }

      const explanation = normalizeText(row[getCol("explanation") ?? ""] ?? "");
      const rawSubject = normalizeText(row[getCol("subject") ?? ""] ?? "");
      const rawSubcategory = normalizeText(row[getCol("subcategory") ?? ""] ?? "");

      const combinedText = `${question}\n${availableChoices.join("\n")}`;
      const classification = classifyByKeywords(combinedText);
      const subject = (normalizeSubject(rawSubject) ?? classification.subject ?? "Analytical Thinking") as ExamCategory;
      const subcategory = (rawSubcategory || classification.subcategory || getDefaultSubcategory(subject)) as ExamSubcategory;
      const difficulty = (row[getCol("difficulty") ?? ""]
        ? normalizeText(row[getCol("difficulty") ?? ""]).toLowerCase()
        : estimateDifficulty(question)) as QuestionDifficulty;

      const choices = [choice_a, choice_b, choice_c, choice_d];
      while (choices.length < 4) choices.push("");
      const fp = [question.toLowerCase(), choices.filter(Boolean).slice().sort().join("||")].join("||");
      if (seen.has(fp)) continue;
      seen.add(fp);

      results.push({
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
  }
  return results;
}
