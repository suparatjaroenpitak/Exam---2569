import { existsSync } from "fs";
import path from "path";

type PythonCommand = {
  command: string;
  args: string[];
};

function getWindowsPythonCandidates() {
  const localAppData = process.env.LOCALAPPDATA || "";

  return [
    process.env.PYTHON_EXEC,
    process.env.npm_config_python,
    localAppData ? path.join(localAppData, "Microsoft", "WindowsApps", "python3.11.exe") : "",
    localAppData ? path.join(localAppData, "Microsoft", "WindowsApps", "python.exe") : ""
  ].filter(Boolean) as string[];
}

export function getPythonCommand(): PythonCommand {
  const windowsCandidates = process.platform === "win32"
    ? getWindowsPythonCandidates().find((candidate) => existsSync(candidate))
    : null;

  if (windowsCandidates) {
    return { command: windowsCandidates, args: [] };
  }

  if (process.env.PYTHON_EXEC) {
    return { command: process.env.PYTHON_EXEC, args: [] };
  }

  return { command: process.platform === "win32" ? "py" : "python3", args: process.platform === "win32" ? ["-3.11"] : [] };
}