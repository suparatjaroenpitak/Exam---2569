import { spawnSync } from "child_process";
import path from "path";

import { getPythonCommand } from "@/lib/python-runtime";

const TOPIC_HINTS: Partial<Record<string, string[]>> = {
  Percentage: ["percentage", "percent", "เปอร์เซ็นต์", "ร้อยละ", "%"],
  Ratio: ["ratio", "อัตราส่วน"],
  Proportion: ["proportion", "สัดส่วน"],
  Equation: ["equation", "สมการ", "ค่า x", "x ="],
  "Speed Distance Time": ["speed", "distance", "time", "อัตราเร็ว", "ระยะทาง", "เวลา"],
  "Number Comparison": ["comparison", "compare", "มากกว่า", "น้อยกว่า", "เปรียบเทียบ"],
  "Data Tables": ["data table", "tables", "table", "ตารางข้อมูล", "ตาราง"],
  "Arithmetic Sequence": ["sequence", "arithmetic", "ลำดับ", "เลขคณิต"],
  "Power Sequence": ["sequence", "power", "ยกกำลัง", "ลำดับ"],
  "Fraction Sequence": ["sequence", "fraction", "เศษส่วน", "ลำดับ"],
  "Mixed Sequence": ["sequence", "mixed", "ผสม", "ลำดับ"],
  "Multi-sequence": ["sequence", "multi", "หลายชุด", "ลำดับ"],
  "Symbolic Conditions": ["symbol", "condition", "สัญลักษณ์", "เงื่อนไข"],
  "Language Conditions": ["language", "condition", "ภาษา", "เงื่อนไข"],
  "Relationship Finding": ["relationship", "ความสัมพันธ์"],
  "Logical Reasoning": ["logical", "reasoning", "logic", "ตรรกะ", "เหตุผล"],
  "Odd-one-out": ["odd", "แตกต่าง", "เข้าพวก"],
  "Truth Tables": ["truth table", "ตารางค่าความจริง", "truth"],
  Tables: ["tables", "table", "ตาราง"],
  Graphs: ["graphs", "graph", "กราฟ"],
  Charts: ["charts", "chart", "แผนภูมิ"],
  "Data Interpretation": ["interpret", "ตีความข้อมูล", "วิเคราะห์ข้อมูล", "data"],
  "Reading Comprehension": ["passage", "อ่าน", "บทความ", "จับใจความ"],
  "Analyze Article": ["analyze", "article", "วิเคราะห์บทความ", "บทความ"],
  Summarize: ["summarize", "summary", "สรุปความ", "ใจความสำคัญ"],
  Interpretation: ["interpretation", "ตีความ"],
  "Correct Word": ["correct word", "ใช้คำ", "คำถูกต้อง"],
  "Incorrect Word": ["incorrect word", "คำไม่ถูกต้อง"],
  "Thai Royal Vocabulary": ["ราชาศัพท์", "royal vocabulary"],
  "Sentence Structure": ["sentence", "structure", "โครงสร้างประโยค"],
  "Conjunction Usage": ["conjunction", "คำสันธาน"],
  "Complete Sentence": ["complete sentence", "ประโยคสมบูรณ์"],
  Synonym: ["synonym", "คำไวพจน์", "ความหมายใกล้เคียง"],
  Antonym: ["antonym", "คำตรงข้าม"],
  "Word Groups": ["word group", "กลุ่มคำ"],
  Tense: ["tense", "verb", "grammar"],
  Preposition: ["preposition"],
  Conjunction: ["conjunction"],
  Article: ["article", "a an the"],
  "Vocabulary Synonym": ["vocabulary", "synonym", "similar meaning"],
  "Vocabulary Antonym": ["vocabulary", "antonym", "opposite meaning"],
  "Fill in the Blank": ["fill in the blank", "blank", "เติมคำ"],
  "Passage Reading": ["passage", "reading", "read the passage"],
  "Story Questions": ["story", "dialogue", "conversation", "เรื่อง"],
  "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": ["ระเบียบบริหารราชการแผ่นดิน", "2534", "มาตรา", "ส่วนราชการ"],
  "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": ["กิจการบ้านเมืองที่ดี", "2546", "ประโยชน์สุข", "บริการประชาชน"],
  "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": ["ปฏิบัติราชการทางปกครอง", "2539", "คำสั่งทางปกครอง"],
  "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": ["ความผิดต่อตำแหน่ง", "เจ้าพนักงาน", "ป.อ.", "2499"],
  "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": ["ละเมิดของเจ้าหน้าที่", "ความรับผิด", "ไล่เบี้ย"],
  "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": ["จริยธรรม", "มาตรฐานทางจริยธรรม", "2562"]
};

function runPy(script: string, payload: any) {
  const python = getPythonCommand();
  const scriptPath = path.join(process.cwd(), "ai_engine", script);
  try {
    const res = spawnSync(python.command, [...python.args, scriptPath], { input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    if (res.error) throw res.error;
    const out = res.stdout ? res.stdout.toString() : "";
    if (!out) return null;
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

export async function isDuplicate(candidate: string, existing: string[], threshold = 0.85): Promise<boolean> {
  const res = runPy("duplicate_detector.py", { candidate, existing, threshold });
  return !!(res && res.duplicate);
}

export async function topicMatches(topic: string, text: string): Promise<boolean> {
  const res = runPy("topic_classifier.py", { topic, text });
  return !!(res && res.matches);
}

export async function validateShape(payload: any): Promise<{ valid: boolean; reason: string } | null> {
  const res = runPy("question_validator.py", payload);
  if (!res) return null;
  return { valid: !!res.valid, reason: (res.reason || "") } as any;
}

export function computeQualityScore(q: { question: string; choice_a: string; choice_b: string; choice_c: string; choice_d: string; difficulty?: string; topic?: string }): number {
  let score = 0;
  const len = q.question ? q.question.trim().length : 0;
  // clarity (0-40)
  if (len >= 80) score += 40;
  else if (len >= 40) score += 30;
  else if (len >= 20) score += 20;
  else score += 10;

  // choice quality (0-30)
  const choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d].map((c) => String(c || "").trim());
  const unique = new Set(choices.filter(Boolean)).size;
  score += Math.min(30, unique * 8);

  // difficulty balance (0-10)
  if (q.difficulty === "easy") score += 8;
  else if (q.difficulty === "medium") score += 7;
  else score += 5;

  // topic relevance (0-20) - simple keyword check
  const text = `${q.question}\n${choices.join("\n")}`.toLowerCase();
  let topicMatch = false;
  if (q.topic) {
    const tokens = [
      q.topic.toLowerCase(),
      q.topic.replace(/\s+/g, "").toLowerCase(),
      ...(TOPIC_HINTS[q.topic] ?? []).map((token) => token.toLowerCase())
    ];
    topicMatch = tokens.some((t) => t && text.includes(t));
  }
  score += topicMatch ? 20 : 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}
