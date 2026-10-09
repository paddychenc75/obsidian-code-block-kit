import { Platform } from "obsidian";

type ChildProcess = import("child_process").ChildProcess;

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
  /** Arguments that make the interpreter read the program from stdin. */
  args(code: string): string[];
}

const stdin = (): string[] => ["-"];
const python: Runner = { command: "python3", windowsCommand: "python", args: stdin };
const node: Runner = { command: "node", args: stdin };
// Node strips the types itself from 22.18 on; older versions reject the flag. On stdin it
// can't detect the module system as it does for JavaScript, so look for import and export.
const typescript: Runner = {
  command: "node",
  args: (code) => [`--input-type=${/^\s*(import|export)\s/m.test(code) ? "module" : "commonjs"}-typescript`],
};

const RUNNERS: Record<string, Runner> = {
  python,
  py: python,
  js: node,
  javascript: node,
  cjs: { command: "node", args: () => ["--input-type=commonjs"] },
  mjs: { command: "node", args: () => ["--input-type=module"] },
  ts: typescript,
  typescript,
  mts: { command: "node", args: () => ["--input-type=module-typescript"] },
  cts: { command: "node", args: () => ["--input-type=commonjs-typescript"] },
};

/** Running needs local interpreters, so it is offered on desktop only. */
export function canRun(lang: string): boolean {
  return Platform.isDesktopApp && Object.prototype.hasOwnProperty.call(RUNNERS, lang);
}

/**
 * Node's process API, loaded on first use. It exists on desktop only, and `canRun` keeps every
 * caller there, so the plugin still loads on mobile, where formatting works.
 */
async function nodeModules() {
  if (!Platform.isDesktop) throw new Error("Running code needs the desktop app");
  const childProcess = await import("child_process");
  return { childProcess, process: window.process };
}

let loginPath: Promise<string> | null = null;

/** Apps launched from the Dock don't inherit the shell's PATH, so ask a login shell for it. */
function resolvePath(): Promise<string> {
  loginPath ??= nodeModules().then(
    ({ childProcess, process }) =>
      new Promise<string>((resolve) => {
        const inherited = process.env.PATH ?? "";
        if (process.platform === "win32") {
          resolve(inherited);
          return;
        }
        const fallback = [inherited, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(":");
        childProcess.execFile(
          process.env.SHELL || "/bin/zsh",
          ["-ilc", 'printf "__CBK__%s__CBK__" "$PATH"'],
          { timeout: 5000 },
          (_error, stdout) => resolve(/__CBK__(.+?)__CBK__/s.exec(stdout ?? "")?.[1] ?? fallback),
        );
      }),
  );
  return loginPath;
}

/** Pipes `code` into the interpreter for `lang`. Nothing is written to disk. */
export function runCode(code: string, lang: string, cwd: string | undefined, events: RunEvents): RunHandle {
  const started = Date.now();
  let child: ChildProcess | null = null;
  let timer = 0;
  let stopped = false;
  let timedOut = false;
  let finished = false;

  const finish = (code: number | null, error?: string): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    events.onExit({ code, error, stopped, timedOut, ms: Date.now() - started });
  };

  let kill = (): void => {};

  void (async () => {
    try {
      const runner = RUNNERS[lang];
      if (!runner) throw new Error(`No runner for "${lang}"`);
      const { childProcess, process } = await nodeModules();
      const windows = process.platform === "win32";
      const command = (windows && runner.windowsCommand) || runner.command;

      const PATH = await resolvePath();
      if (stopped) {
        finish(null);
        return;
      }

      const spawned = childProcess.spawn(command, runner.args(code), {
        cwd,
        env: { ...process.env, PATH, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
        stdio: ["pipe", "pipe", "pipe"],
        detached: !windows,
      });
      // An interpreter that fails to start closes the pipe early; the exit reports that.
      spawned.stdin?.on("error", () => {});
      spawned.stdin?.end(code);
      child = spawned;
      kill = () => {
        if (!spawned.pid) return;
        try {
          // The child leads its own process group, so this also ends anything it spawned.
          if (windows) spawned.kill();
          else process.kill(-spawned.pid, "SIGKILL");
        } catch {
          spawned.kill("SIGKILL");
        }
      };
      spawned.stdout?.setEncoding("utf8").on("data", (text: string) => events.onData(text, "stdout"));
      spawned.stderr?.setEncoding("utf8").on("data", (text: string) => events.onData(text, "stderr"));
      spawned.on("error", (error: Error & { code?: string }) => {
        finish(null, error.code === "ENOENT" ? `"${command}" was not found on your PATH` : error.message);
      });
      spawned.on("close", (code) => finish(code));
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
      if (child) kill();
    },
  };
}
