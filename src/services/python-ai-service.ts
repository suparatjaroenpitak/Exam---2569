import { spawnSync } from "child_process";
import path from "path";

import { env } from "@/lib/env";
import { getPythonCommand } from "@/lib/python-runtime";

export async function generateWithPythonEngine(input: { category: string; subcategory: string; count: number; difficulty: string }) {
  const python = getPythonCommand();
  const script = path.join(process.cwd(), "ai_engine", "question_generator.py");
  const bundledPythonPath = path.join(process.cwd(), ".render-python");
  const resolvedPythonPath = process.env.PYTHONPATH
    ? `${bundledPythonPath}${path.delimiter}${process.env.PYTHONPATH}`
    : bundledPythonPath;
  const payload = JSON.stringify({ subject: input.category, topic: input.subcategory, count: input.count, difficulty: input.difficulty });
  const childEnv = {
    ...process.env,
    PYTHONPATH: resolvedPythonPath,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || env.huggingFaceApiKey,
    THAI_GENERATOR_MODEL: process.env.THAI_GENERATOR_MODEL || env.thaiGeneratorModel,
    TRANSFORMERS_MODEL: process.env.TRANSFORMERS_MODEL || env.transformersModel,
    TRANSFORMERS_MAX_NEW_TOKENS: process.env.TRANSFORMERS_MAX_NEW_TOKENS || env.transformersMaxNewTokens,
    TRANSFORMERS_TEMPERATURE: process.env.TRANSFORMERS_TEMPERATURE || env.transformersTemperature,
    THAI_GENERATOR_BASE_URL: process.env.THAI_GENERATOR_BASE_URL || env.thaiGeneratorBaseUrl
  };

  const res = spawnSync(python.command, [...python.args, script], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: childEnv
  });

  if (res.error) {
    throw res.error;
  }

  const stdout = res.stdout ? res.stdout.toString().trim() : "";
  const stderr = res.stderr ? res.stderr.toString().trim() : "";

  if (res.status !== 0) {
    const detail = stderr || stdout || `Python generator exited with status ${res.status}`;
    throw new Error(`${detail} [python=${python.command}${python.args.length ? ` ${python.args.join(" ")}` : ""}]`);
  }

  if (!stdout) {
    return [];
  }

  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) return [];
  // normalize minimal shape
  return parsed.map((r: any) => ({
    subject: r.subject || input.category,
    category: r.subject || input.category,
    subcategory: r.topic || input.subcategory,
    question: r.question,
    choice_a: r.choice_a,
    choice_b: r.choice_b,
    choice_c: r.choice_c,
    choice_d: r.choice_d,
    correct_answer: (r.correct_answer || "A").toUpperCase(),
    explanation: r.explanation || "",
    difficulty: r.difficulty || input.difficulty,
    source: "nlp"
  }));
}
