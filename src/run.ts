export const TIMEOUT_MS = 60_000;

export type Stream = "stdout" | "stderr";

export interface RunResult {
  /** False when the code threw, was stopped, or timed out. */
  ok: boolean;
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

const TYPESCRIPT = new Set(["ts", "typescript", "mts"]);
const JAVASCRIPT = new Set(["js", "javascript", "mjs"]);

export function canRun(lang: string): boolean {
  return JAVASCRIPT.has(lang) || TYPESCRIPT.has(lang);
}

type Message = { type: "out" | "err"; text: string } | { type: "done" } | { type: "fail"; text: string };

/**
 * Runs inside the worker ahead of the block. It sends console output to the plugin and reports
 * when the program has nothing left to do: the block has finished and no timer is still pending,
 * which is when Node would exit too.
 */
const PRELUDE = `
const __cbk = (() => {
  const post = (message) => self.postMessage(message);
  const show = (value, nested) => {
    if (typeof value === "string") return nested ? JSON.stringify(value) : value;
    if (typeof value === "function") return "[Function " + (value.name || "anonymous") + "]";
    if (typeof value === "bigint") return value + "n";
    // Not the stack: its frames point into the worker's blob, at lines the note doesn't have.
    if (value instanceof Error) return String(value);
    if (value === null || typeof value !== "object") return String(value);
    const seen = new WeakSet();
    const plain = (key, item) => {
      if (typeof item === "bigint") return item + "n";
      if (typeof item === "function") return "[Function " + (item.name || "anonymous") + "]";
      if (item === undefined) return "undefined";
      if (item instanceof Map) return { Map: Array.from(item) };
      if (item instanceof Set) return { Set: Array.from(item) };
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    };
    try {
      const short = JSON.stringify(value, plain);
      seen.delete(value);
      return short.length <= 72 ? short : JSON.stringify(value, (key, item) => (item === value ? item : plain(key, item)), 2);
    } catch (error) {
      return String(value);
    }
  };
  const line = (values) => values.map((value) => show(value, false)).join(" ") + "\\n";
  for (const name of ["log", "info", "debug"]) console[name] = (...values) => post({ type: "out", text: line(values) });
  for (const name of ["warn", "error"]) console[name] = (...values) => post({ type: "err", text: line(values) });

  let finished = false;
  const pending = new Set();
  const settle = () => {
    if (finished && pending.size === 0) post({ type: "done" });
  };
  const timeout = self.setTimeout.bind(self);
  const interval = self.setInterval.bind(self);
  const clear = self.clearTimeout.bind(self);
  self.setTimeout = (callback, delay, ...rest) => {
    const id = timeout(() => {
      try {
        callback(...rest);
      } finally {
        pending.delete(id);
        settle();
      }
    }, delay);
    pending.add(id);
    return id;
  };
  self.setInterval = (callback, delay, ...rest) => {
    const id = interval(callback, delay, ...rest);
    pending.add(id);
    return id;
  };
  self.clearTimeout = self.clearInterval = (id) => {
    clear(id);
    pending.delete(id);
    settle();
  };
  self.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    post({ type: "fail", text: "Uncaught (in promise) " + show(event.reason, false) });
  });
  // A promise the block left rejected is reported in a later task than the one the block ends
  // in, so let two go by before calling the run finished.
  return () =>
    timeout(() => {
      timeout(() => {
        finished = true;
        settle();
      }, 0);
    }, 0);
})();
`;
const PRELUDE_LINES = PRELUDE.split("\n").length - 1;

/** TypeScript is reduced to JavaScript line for line, so reported line numbers still match. */
async function toJavaScript(code: string, lang: string): Promise<string> {
  if (!TYPESCRIPT.has(lang)) return code;
  const { transform } = await import("sucrase");
  return transform(code, { transforms: ["typescript"], disableESTransforms: true }).code;
}

/**
 * Runs `code` as a module in a Web Worker, so the plugin starts nothing outside Obsidian and a
 * runaway loop can be stopped. It is not a security boundary: on desktop Obsidian gives workers
 * Node, so the code can still `require` anything.
 */
export function runCode(code: string, lang: string, events: RunEvents): RunHandle {
  const started = Date.now();
  let worker: Worker | null = null;
  let url = "";
  let timer = 0;
  let stopped = false;
  let timedOut = false;
  let finished = false;

  const finish = (ok: boolean): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
    events.onExit({ ok: ok && !stopped && !timedOut, stopped, timedOut, ms: Date.now() - started });
  };

  void (async () => {
    try {
      const script = await toJavaScript(code, lang);
      if (stopped) {
        finish(false);
        return;
      }
      // The trailing call runs once the block, top-level awaits included, has finished.
      const source = `${PRELUDE}${script}\n;__cbk();\n`;
      url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      worker = new Worker(url, { type: "module" });
      worker.onmessage = (event: MessageEvent<Message>) => {
        const message = event.data;
        if (message.type === "done") finish(true);
        else if (message.type === "fail") {
          events.onData(`${message.text}\n`, "stderr");
          finish(false);
        } else events.onData(message.text, message.type === "err" ? "stderr" : "stdout");
      };
      worker.onerror = (event) => {
        event.preventDefault();
        const line = event.lineno > PRELUDE_LINES ? ` (line ${event.lineno - PRELUDE_LINES})` : "";
        events.onData(`${event.message || "The code could not be loaded"}${line}\n`, "stderr");
        finish(false);
      };
      timer = window.setTimeout(() => {
        timedOut = true;
        finish(false);
      }, TIMEOUT_MS);
    } catch (error) {
      events.onData(`${error instanceof Error ? error.message : String(error)}\n`, "stderr");
      finish(false);
    }
  })();

  return {
    stop: () => {
      if (finished) return;
      stopped = true;
      finish(false);
    },
  };
}
