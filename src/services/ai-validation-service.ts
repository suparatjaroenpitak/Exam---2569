import { spawnSync } from "child_process";
import path from "path";

function runPy(script: string, payload: any) {
  const py = process.env.PYTHON_EXEC || "python";
  const scriptPath = path.join(process.cwd(), "ai_engine", script);
  try {
    const res = spawnSync(py, [scriptPath], { input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
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
    const tokens = [q.topic.toLowerCase(), q.topic.replace(/\s+/g, "").toLowerCase()];
    topicMatch = tokens.some((t) => t && text.includes(t));
  }
  score += topicMatch ? 20 : 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}
