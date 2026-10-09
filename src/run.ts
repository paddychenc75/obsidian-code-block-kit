import { Platform } from "obsidian";
import type { ChildProcess } from "child_process";

export const TIMEOUT_MS = 60_000;

export type Stream = "stdout" | "stderr";

export interface RunResult {
  /** Exit code, or null when the process never started or was killed. */
  code: number | null;
  error?: string;
  stopped: boolean;
  timedOut: boolean;
  ms: number;
}

export interface RunEvents {
  onData(text: string, stream: Stream): void;
  onExit(result: RunResult): void;
}

export interface RunHandle {
  stop(): void;
}

interface Runner {
  command: string;
  windowsCommand?: string;
  ext: string;
}

const python: Runner = { command: "python3", windowsCommand: "python", ext: "py" };
const node: Runner = { command: "node", ext: "js" };
const bash: Runner = { command: "bash", ext: "sh" };

const RUNNERS: Record<string, Runner> = {
  python,
  py: python,
  js: node,
  javascript: node,
  cjs: node,
  mjs: { command: "node", ext: "mjs" },
  // Node strips the types itself from 22.18 on; older versions report the unknown extension.
  ts: { command: "node", ext: "ts" },
  typescript: { command: "node", ext: "ts" },
  mts: { command: "node", ext: "mts" },
  cts: { command: "node", ext: "cts" },
  sh: bash,
  bash,
  shell: bash,
  zsh: { command: "zsh", ext: "zsh" },
};

/** Running needs local interpreters, so it is offered on desktop only. */
export function canRun(lang: string): boolean {
  return Platform.isDesktopApp && Object.prototype.hasOwnProperty.call(RUNNERS, lang);
}

let loginPath: Promise<string> | null = null;

/** Apps launched from the Dock don't inherit the shell's PATH, so ask a login shell for it. */
function resolvePath(): Promise<string> {
  loginPath ??= new Promise((resolve) => {
    const inherited = process.env.PATH ?? "";
    if (process.platform === "win32") {
      resolve(inherited);
      return;
    }
    const fallback = [inherited, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(":");
    const { execFile } = require("child_process") as typeof import("child_process");
    execFile(
      process.env.SHELL || "/bin/zsh",
      ["-ilc", 'printf "__CBK__%s__CBK__" "$PATH"'],
      { timeout: 5000 },
      (_error, stdout) => resolve(/__CBK__(.+?)__CBK__/s.exec(stdout ?? "")?.[1] ?? fallback),
    );
  });
  return loginPath;
}

/** Runs `code` from a temporary file with the interpreter for `lang`. */
export function runCode(code: string, lang: string, cwd: string | undefined, events: RunEvents): RunHandle {
  const fs = require("fs") as typeof import("fs");
  const os = require("os") as typeof import("os");
  const path = require("path") as typeof import("path");
  const { spawn } = require("child_process") as typeof import("child_process");

  const windows = process.platform === "win32";
  const started = Date.now();
  let child: ChildProcess | null = null;
  let dir: string | null = null;
  let timer = 0;
  let stopped = false;
  let timedOut = false;
  let finished = false;

  const finish = (code: number | null, error?: string): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    if (dir) void fs.promises.rm(dir, { recursive: true, force: true });
    events.onExit({ code, error, stopped, timedOut, ms: Date.now() - started });
  };

  const kill = (): void => {
    if (!child?.pid) return;
    try {
      // The child leads its own process group, so this also ends anything it spawned.
      if (windows) child.kill();
      else process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  };

  void (async () => {
    try {
      const runner = RUNNERS[lang];
      if (!runner) throw new Error(`No runner for "${lang}"`);
      const command = (windows && runner.windowsCommand) || runner.command;

      const PATH = await resolvePath();
      dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "code-block-kit-"));
      const file = path.join(dir, `snippet.${runner.ext}`);
      await fs.promises.writeFile(file, code);
      if (stopped) {
        finish(null);
        return;
      }

      child = spawn(command, [file], {
        cwd,
        env: { ...process.env, PATH, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: !windows,
      });
      child.stdout?.setEncoding("utf8").on("data", (text: string) => events.onData(text, "stdout"));
      child.stderr?.setEncoding("utf8").on("data", (text: string) => events.onData(text, "stderr"));
      child.on("error", (error: NodeJS.ErrnoException) => {
        finish(null, error.code === "ENOENT" ? `"${command}" was not found on your PATH` : error.message);
      });
      child.on("close", (code) => finish(code));
      timer = window.setTimeout(() => {
        timedOut = true;
        kill();
      }, TIMEOUT_MS);
    } catch (error) {
      finish(null, error instanceof Error ? error.message : String(error));
    }
  })();

  return {
    stop: () => {
      if (finished) return;
      stopped = true;
      kill();
    },
  };
}
