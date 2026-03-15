function normalizeLine(value: string) {
  return value.replace(/\r/g, "").trim();
}

export function splitPdfIntoQuestionCandidates(text: string) {
  const normalized = text
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .join("\n");

  return normalized
    .split(/(?=(?:Question\s*:?|\d+[\.)]\s))/gi)
    .map((block) => block.trim())
    .filter((block) => block.length > 30);
}

function mapThaiChoiceLabel(label: string) {
  const map: Record<string, string> = { ก: "A", ข: "B", ค: "C", ง: "D" };
  return map[label] ?? null;
}

function extractChoices(block: string) {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const choiceRegex = /^(?:([A-D])|(?:\(?([ก-ฮ])\)?))\s*[\.)]?\s*(.*)$/i;
  const choices: string[] = [];
  const usedLabels: string[] = [];

  for (const line of lines) {
    const m = line.match(choiceRegex);
    if (m) {
      const latin = m[1];
      const thai = m[2];
      const text = m[3] || "";
      const label = (latin || (thai ? mapThaiChoiceLabel(thai) : null) || "").toUpperCase();
      if (label && ["A","B","C","D"].includes(label) && !usedLabels.includes(label)) {
        usedLabels.push(label);
        choices.push(text.trim());
      }
    }
  }

  // Fallback: attempt to split by common separators if no explicit labels
  if (choices.length === 0) {
    const parts = block.split(/\s{2,}|\t|\n(?=[A-D]|[ก-ฮ])/);
    for (const p of parts) {
      if (/^[A-D]\s*[\.)]/i.test(p) || /^[ก-ฮ]\s*[\.)]/.test(p)) continue;
    }
  }

  return choices;
}

export function parseCandidate(candidate: string) {
  // Try to split question and choices
  const lines = candidate.split('\n').map((l) => l.trim()).filter(Boolean);
  // Find first line that looks like a choice
  const choiceStartIndex = lines.findIndex((l) => /^[A-D\(ก-ฮ)]/.test(l) || /^[ก-ฮ]\s*[\.)]/.test(l));

  let questionText = "";
  let choices: string[] = [];

  if (choiceStartIndex >= 0) {
    questionText = lines.slice(0, choiceStartIndex).join(' ');
    const choiceBlock = lines.slice(choiceStartIndex).join('\n');
    choices = extractChoices(choiceBlock);
  } else {
    // heuristic: split by question mark or question prefix
    const parts = candidate.split(/\?|\?/);
    questionText = parts[0].trim();
    choices = extractChoices(candidate);
  }

  // Try to detect explicit answer key
  const answerMatch = candidate.match(/(Answer|เฉลย|คำตอบ)\s*[:\-]?\s*([A-Dก-ฮ])/i);
  let correct: string | null = null;
  if (answerMatch) {
    const val = answerMatch[2].toUpperCase();
    if (/^[A-D]$/.test(val)) correct = val;
    else {
      const mapped = mapThaiChoiceLabel(val);
      if (mapped) correct = mapped;
    }
  }

  return {
    raw: candidate,
    question: questionText || candidate.slice(0, 120),
    choices,
    correct_answer: correct
  };
}

import { EXAM_CATEGORIES, getDefaultSubcategory } from "./constants";

export function classifyByKeywords(text: string) {
  const lower = text.toLowerCase();
  // Government / Law keywords (Thai)
  const lawKeywords = ["พ.ร.บ", "พ.ร.ฎ", "กฎหมาย", "มาตรา", "ละเมิด", "เจ้าหน้าที่", "จริยธรรม", "ประมวลกฎหมาย", "ป.อ."];
  const thaiLangKeywords = ["คำ", "ประโยค", "สะกด", "ความหมาย", "คำศัพท์", "ภาษาไทย", "อ่าน"].map((s) => s.toLowerCase());
  const englishKeywords = ["choose", "which", "synonym", "antonym", "vocabulary", "english", "passage"];
  const analyticKeywords = ["%", "เปอร์เซ็นต์", "ร้อยละ", "จำนวน", "รวม", "หาร", "สูตร", "สมการ", "อัตรา", "ratio", "percent", "sum", "equation", "compare"];

  for (const k of lawKeywords) if (text.includes(k)) return { subject: "Government Law & Ethics", subcategory: getDefaultSubcategory("Government Law & Ethics") };
  for (const k of thaiLangKeywords) if (lower.includes(k)) return { subject: "Thai Language", subcategory: getDefaultSubcategory("Thai Language") };
  for (const k of englishKeywords) if (lower.includes(k)) return { subject: "English Language", subcategory: getDefaultSubcategory("English Language") };
  for (const k of analyticKeywords) if (lower.includes(k)) return { subject: "Analytical Thinking", subcategory: getDefaultSubcategory("Analytical Thinking") };

  // Fallback: decide by presence of ascii-heavy content
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / Math.max(1, text.length);
  if (asciiRatio > 0.5) {
    return { subject: "English Language", subcategory: getDefaultSubcategory("English Language") };
  }

  return { subject: "Analytical Thinking", subcategory: getDefaultSubcategory("Analytical Thinking") };
}

export function estimateDifficulty(questionText: string) {
  const len = questionText.length;
  const digits = (questionText.match(/\d/g) || []).length;
  if (len < 40 && digits < 3) return "easy";
  if (len < 120 && digits < 6) return "medium";
  return "hard";
}
