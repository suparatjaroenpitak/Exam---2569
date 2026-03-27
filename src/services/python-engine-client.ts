import { spawnSync } from "child_process";
import path from "path";

import { env } from "@/lib/env";
import { getPythonCommand } from "@/lib/python-runtime";

async function callHttp(endpoint: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${env.pythonAiUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Python AI HTTP request failed for ${env.pythonAiUrl}${endpoint}: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

function callCli(command: string, payload: unknown) {
  const python = getPythonCommand();
  const scriptPath = path.join(process.cwd(), "ai_engine", "main.py");
  const result = spawnSync(python.command, [...python.args, scriptPath, command], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `Python AI command failed with code ${result.status}`);
  }
  return JSON.parse(result.stdout || "{}");
}

export async function callPythonAi(endpoint: string, cliCommand: string, payload: unknown) {
  try {
    return await callHttp(endpoint, payload);
  } catch (httpError) {
    if (!env.allowPythonCliFallback) {
      throw httpError;
    }

    return callCli(cliCommand, payload);
  }
}