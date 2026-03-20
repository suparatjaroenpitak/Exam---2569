import { aiExtractQuestionsFromText } from "@/services/wangchan-nlp-service";

function normalizeLine(value: string) {
  return value.replace(/\r/g, "").trim();
}

// Normalize PDF raw text: whitespace, full-width conversion, remove common headers
export function pdfParser(raw: string) {
  if (!raw || typeof raw !== "string") return "";
  // normalize unicode whitespace
  let text = raw.replace(/\u3000/g, " ").replace(/[\u00A0\t]+/g, " ");
  // normalize repeated spaces and newlines
  text = text.replace(/\r/g, "\n").replace(/\n{2,}/g, "\n\n");
  // remove simple page headers like 'Page X' or repeated doc title lines
  text = text.split('\n').map((line) => line.replace(/^(Page|หน้า)\s*\d+/i, "").trim()).join('\n');
  // strip control chars
  text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "");
  return text.trim();
}

export function splitPdfIntoQuestionCandidates(text: string) {
  const banned = [
    "explanation",
    "answer explanation",
    "imported with parser",
    "metadata",
    "footer",
    "page",
    "page number"
  ];

  const lines = text.split("\n").map(normalizeLine).filter(Boolean);
  // filter out obvious footer/metadata lines
  const cleaned = lines.filter((l) => !banned.some((b) => l.toLowerCase().includes(b)));
  const joined = cleaned.join("\n");

  // Split by lines that start with a number followed by a dot
  const blocks = joined.split(/(?=^\s*\d+\.)/m).map((b) => b.trim());

  // Keep only blocks that look like a question with choices A. B. C. D.
  return blocks.filter((block) => {
    if (!block || block.length < 30) return false;
    // must contain A. B. C. D. markers
    const hasChoices = /\bA\.|\bB\.|\bC\.|\bD\./.test(block);
    return hasChoices && /\d+\./.test(block);
  });
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

// Extract questions from PDF text with parser first, then AI fallback.
export async function extractQuestions(rawText: string) {
  const normalized = pdfParser(rawText || "");
  const candidates = splitPdfIntoQuestionCandidates(normalized);

  const extracted: Array<{ question: string; choices: string[]; correct_answer?: string; raw: string }> = [];

  for (const c of candidates) {
    const parsed = parseCandidate(c);
    if (parsed && parsed.question) {
      extracted.push({ question: parsed.question, choices: parsed.choices, correct_answer: parsed.correct_answer || undefined, raw: parsed.raw });
    }
  }

  // If parser found nothing or very few candidates, call AI extractor fallback
  if (extracted.length === 0) {
    try {
      const aiRows = await aiExtractQuestionsFromText(normalized, { maxQuestions: 200 });
      for (const r of aiRows) {
        const choices = [r.choice_a, r.choice_b, r.choice_c, r.choice_d].filter(Boolean);
        extracted.push({ question: r.question, choices, correct_answer: r.correct_answer || undefined, raw: r.question });
      }
    } catch (e) {
      // ignore
    }
  }

  // Ensure we never return empty result: if still empty, return a single REVIEW_REQUIRED block
  if (extracted.length === 0 && normalized.trim().length > 20) {
    return [{ question: normalized.slice(0, 500), choices: [], raw: normalized }];
  }

  return extracted;
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
