import { spawnSync } from "child_process";

import { env } from "@/lib/env";
import { getPythonCommand } from "@/lib/python-runtime";

const isAbsolutePythonAiUrl = /^https?:\/\//i.test(env.pythonAiUrl);
const isLocalPythonAiUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(env.pythonAiUrl);
const isProductionRuntime = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);

async function isServerReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    const res = await fetch(`${url}/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function callHttp(endpoint: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
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
    throw new Error(`Python AI HTTP request failed: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

function callCli(command: string, payload: unknown) {
  const python = getPythonCommand();
  const input = JSON.stringify(payload);
  const result = spawnSync(python.command, [...python.args, "-m", "ai_engine.main", command], {
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" }
  });

  if (result.error) {
    throw new Error(`Python spawn failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ? `: ${result.stderr.trim().slice(0, 200)}` : "";
    throw new Error(`Python exited with code ${result.status}${stderr}`);
  }
  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new Error("Python produced no output");
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Python output is not valid JSON: ${stdout.slice(0, 200)}`);
  }
}

export async function callPythonAi(endpoint: string, cliCommand: string, payload: unknown) {
  // If it's a local URL and the server is not running, skip HTTP and go straight to CLI
  if (isLocalPythonAiUrl) {
    const reachable = await isServerReachable(env.pythonAiUrl);
    if (!reachable) {
      if (!env.allowPythonCliFallback) {
        throw new Error("Python AI server is not running and CLI fallback is disabled.");
      }
      return callCli(cliCommand, payload);
    }
    return await callHttp(endpoint, payload);
  }

  // Remote/absolute URL: try HTTP first, fall back to CLI if allowed
  if (!isAbsolutePythonAiUrl) {
    if (!env.allowPythonCliFallback) {
      throw new Error("Production AI configuration is invalid: no reachable AI service URL is configured.");
    }
    return callCli(cliCommand, payload);
  }

  try {
    return await callHttp(endpoint, payload);
  } catch (httpError) {
    if (!env.allowPythonCliFallback) {
      throw httpError;
    }
    return callCli(cliCommand, payload);
  }
}
