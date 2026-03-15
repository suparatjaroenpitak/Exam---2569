import { loadQuestions, saveQuestions } from "@/lib/excel-db";
import { getDefaultSubcategory } from "@/lib/constants";
import type { QuestionRecord } from "@/lib/types";

function normalizeText(s: unknown) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function fingerprint(row: QuestionRecord) {
  const q = normalizeText(row.question);
  const choices = [row.choice_a, row.choice_b, row.choice_c, row.choice_d].map(normalizeText);
  const sorted = choices.slice().sort();
  const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const keyIndex = keyMap[String(row.correct_answer) || ""]; 
  const correctText = typeof keyIndex === "number" && choices[keyIndex] ? choices[keyIndex] : "";
  const sub = row.subcategory || getDefaultSubcategory(row.subject);

  return [q, sorted.join("||"), correctText, normalizeText(sub)].join("||");
}

async function run() {
  const rows = await loadQuestions();
  const seen = new Set<string>();
  const deduped: QuestionRecord[] = [];

  for (const row of rows) {
    const fp = fingerprint(row);
    if (seen.has(fp)) continue;
    seen.add(fp);
    // ensure subcategory exists
    if (!row.subcategory || String(row.subcategory).trim() === "") {
      row.subcategory = getDefaultSubcategory(row.subject as any);
    }
    deduped.push(row);
  }

  if (deduped.length === rows.length) {
    console.log(`No duplicates found — ${rows.length} rows unchanged.`);
    return;
  }

  await saveQuestions(deduped);
  console.log(`Deduplicated questions: ${rows.length} -> ${deduped.length} rows saved.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
