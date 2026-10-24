// Starts the FastAPI dev server from the api virtualenv (works on Windows and Unix).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const apiDir = join(import.meta.dirname, "..", "apps", "api");
const win = process.platform === "win32";
const python = join(apiDir, ".venv", win ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) {
  console.error("apps/api/.venv not found. Run: python -m venv apps/api/.venv && pip install -r apps/api/requirements-dev.txt");
  process.exit(1);
}
spawn(python, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], { cwd: apiDir, stdio: "inherit" })
  .on("exit", (code) => process.exit(code ?? 0));
