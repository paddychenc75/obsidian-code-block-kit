import type { EditorView } from "@codemirror/view";
import {
  Editor,
  editorInfoField,
  FileSystemAdapter,
  MarkdownPostProcessorContext,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { Fence, parseFences, withPrefix } from "./fence";
import { canFormat, formatCode } from "./format";
import { liveButtons, mountOutput, outputField } from "./live";
import { OutputPanel, setButtonIcon } from "./output";
import { apply, measure } from "./place";
import { canRun, runCode, RunHandle, RunResult, TIMEOUT_MS } from "./run";

const CODE = "pre > code";

/** Puts a run's panel on screen and returns the function that takes it down again. */
type Mount = (panel: OutputPanel, close: () => void) => () => void;

function languageOf(code: HTMLElement): string {
  for (const cls of Array.from(code.classList)) {
    if (cls.startsWith("language-")) return cls.slice("language-".length).toLowerCase();
  }
  return "";
}

function renderedText(code: HTMLElement): string {
  return (code.textContent ?? "").trimEnd();
}

function summarize(result: RunResult): string {
  if (result.error) return `Failed: ${result.error}`;
  if (result.timedOut) return `Timed out after ${TIMEOUT_MS / 1000} s`;
  if (result.stopped) return "Stopped";
  return `Exited with code ${result.code ?? "?"} · ${(result.ms / 1000).toFixed(2)} s`;
}

export default class CodeBlockKitPlugin extends Plugin {
  /** Close functions of the runs whose panels are still on screen. */
  private runs = new Set<() => void>();
  private renderedRuns = new WeakMap<HTMLElement, () => void>();
  /** Places a rendered block's buttons once it is laid out, which is after it is decorated. */
  private shown = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      this.shown.unobserve(entry.target);
      this.place(entry.target as HTMLElement);
    }
  });

  onload(): void {
    this.registerMarkdownPostProcessor((el, ctx) => this.decorate(el, ctx));

    this.addCommand({
      id: "format-code-block",
      name: "Format code block at cursor",
      editorCallback: (editor) => void this.formatAt(editor, editor.getCursor().line),
    });
    this.addCommand({
      id: "run-code-block",
      name: "Run code block at cursor",
      editorCallback: (editor) => this.runAt(editor, editor.getCursor().line),
    });

    this.registerEditorExtension([
      liveButtons(
        (editor, line) => this.formatAt(editor, line),
        (editor, line) => this.runAt(editor, line),
      ),
      outputField,
    ]);
  }

  onunload(): void {
    this.shown.disconnect();
    for (const close of Array.from(this.runs)) close();
    this.app.workspace.iterateAllLeaves((leaf) => {
      leaf.view.containerEl.querySelectorAll(".cbk-button").forEach((button) => button.remove());
    });
  }

  private decorate(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    for (const code of Array.from(el.querySelectorAll<HTMLElement>(CODE))) {
      const pre = code.parentElement;
      const lang = languageOf(code);
      if (!pre || pre.querySelector(".cbk-button")) continue;

      const buttons: HTMLElement[] = [];
      const add = (icon: string, label: string, onClick: (button: HTMLElement) => void): void => {
        const button = pre.createDiv({
          cls: "cbk-button clickable-icon",
          attr: { role: "button", "aria-label": label },
        });
        setButtonIcon(button, icon);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick(button);
        });
        buttons.push(button);
      };

      if (canFormat(lang)) {
        add("wand-sparkles", "Format code", (button) => {
          if (button.hasClass("is-busy")) return;
          button.addClass("is-busy");
          void this.formatRendered(el, code, ctx).finally(() => button.removeClass("is-busy"));
        });
      }
      if (canRun(lang)) {
        add("play", "Run code", () => {
          this.run(renderedText(code), lang, ctx.sourcePath, (panel, close) => {
            this.renderedRuns.get(pre)?.();
            pre.insertAdjacentElement("afterend", panel.el);
            this.renderedRuns.set(pre, close);
            return () => panel.el.remove();
          });
        });
      }
      if (!buttons.length) continue;

      this.shown.observe(pre);
      pre.addEventListener("pointerenter", () => this.place(pre));
    }
  }

  /** Themes size and place the copy button differently, so line up beside wherever it is. */
  private place(pre: HTMLElement): void {
    // The copy button is only laid out while the block is hovered; this class lays it out unseen.
    pre.addClass("cbk-measuring");
    const copy = pre.querySelector<HTMLElement>(":scope > .copy-code-button");
    const buttons = Array.from(pre.querySelectorAll<HTMLElement>(":scope > .cbk-button"));
    const placements = measure(pre, copy, buttons);
    pre.removeClass("cbk-measuring");
    apply(placements);
  }

  private async format(code: string, lang: string): Promise<string | null> {
    try {
      return await formatCode(code, lang);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Code Block Kit: format failed", error);
      new Notice(`Format failed: ${message.split("\n")[0] ?? ""}`);
      return null;
    }
  }

  private async formatRendered(
    el: HTMLElement,
    code: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const info = ctx.getSectionInfo(code) ?? ctx.getSectionInfo(el);
    const file = this.app.vault.getFileByPath(ctx.sourcePath);
    if (!info || !file) {
      new Notice("Can't locate this code block in the note.");
      return;
    }

    const lines = info.text.split(/\r?\n/);
    const fence = this.matchFence(parseFences(lines, info.lineStart, info.lineEnd), el, code);
    if (!fence) {
      new Notice("Can't locate this code block in the note.");
      return;
    }

    const formatted = await this.format(fence.code, languageOf(code));
    if (formatted === null) return;
    if (formatted === fence.code) {
      new Notice("Already formatted.");
      return;
    }

    await this.flush(file);
    const expected = lines.slice(fence.open, fence.last + 1);
    let applied = false;
    await this.app.vault.process(file, (data) => {
      const eol = data.includes("\r\n") ? "\r\n" : "\n";
      const current = data.split(/\r?\n/);
      // The rendered section can lag behind the file; never write over lines that moved.
      if (expected.some((line, i) => current[fence.open + i] !== line)) return data;
      applied = true;
      current.splice(fence.open + 1, fence.last - fence.open, ...withPrefix(fence, formatted));
      return current.join(eol);
    });
    if (!applied) new Notice("The note changed since this block was rendered. Try again.");
  }

  /** Several blocks in one section can render identically, so match by text, then by order. */
  private matchFence(fences: Fence[], el: HTMLElement, code: HTMLElement): Fence | null {
    const text = renderedText(code);
    const twins = Array.from(el.querySelectorAll<HTMLElement>(CODE)).filter(
      (other) => renderedText(other) === text,
    );
    const candidates = fences.filter((fence) => fence.code.trimEnd() === text);
    return candidates[twins.indexOf(code)] ?? null;
  }

  /** Saves editors holding unsaved changes to `file`, so the write below starts from them. */
  private async flush(file: TFile): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file === file) await leaf.view.save();
    }
  }

  private fenceAt(lines: string[], line: number): Fence | null {
    const fence = parseFences(lines).find(
      (candidate) => line >= candidate.open && line <= candidate.last + (candidate.closed ? 1 : 0),
    );
    if (!fence) new Notice("Place the cursor inside a code block.");
    return fence ?? null;
  }

  /** Formats the code block that contains `line`, fences included. */
  private async formatAt(editor: Editor, line: number): Promise<void> {
    const lines = editor.getValue().split("\n");
    const fence = this.fenceAt(lines, line);
    if (!fence) return;
    if (!canFormat(fence.lang)) {
      new Notice(fence.lang ? `No formatter for "${fence.lang}".` : "This code block has no language.");
      return;
    }
    if (fence.last === fence.open) return;

    const formatted = await this.format(fence.code, fence.lang);
    if (formatted === null) return;
    if (formatted === fence.code) {
      new Notice("Already formatted.");
      return;
    }

    const from = { line: fence.open + 1, ch: 0 };
    const to = { line: fence.last, ch: (lines[fence.last] ?? "").length };
    if (editor.getRange(from, to) !== lines.slice(fence.open + 1, fence.last + 1).join("\n")) {
      new Notice("The note changed while formatting. Try again.");
      return;
    }
    editor.replaceRange(withPrefix(fence, formatted).join("\n"), from, to);
  }

  /** Runs the code block that contains `line` and shows its output below the block. */
  private runAt(editor: Editor, line: number): void {
    const fence = this.fenceAt(editor.getValue().split("\n"), line);
    if (!fence) return;
    if (!canRun(fence.lang)) {
      new Notice(fence.lang ? `Can't run "${fence.lang}" code.` : "This code block has no language.");
      return;
    }
    const view = (editor as Editor & { cm?: EditorView }).cm;
    if (!view) return;

    const below = view.state.doc.line(fence.last + (fence.closed ? 2 : 1)).to;
    const sourcePath = view.state.field(editorInfoField).file?.path ?? "";
    this.run(fence.code, fence.lang, sourcePath, (panel, close) => mountOutput(view, below, panel.el, close));
  }

  private run(code: string, lang: string, sourcePath: string, mount: Mount): void {
    let handle: RunHandle | null = null;
    let unmount = (): void => {};
    const close = (): void => {
      handle?.stop();
      unmount();
      this.runs.delete(close);
    };
    const panel = new OutputPanel(() => handle?.stop(), close);
    unmount = mount(panel, close);
    this.runs.add(close);

    handle = runCode(code, lang, this.folderOf(sourcePath), {
      onData: (text, stream) => panel.write(text, stream),
      onExit: (result) => panel.finish(summarize(result), result.code === 0),
    });
  }

  /** Runs start in the note's own folder so relative paths in the code resolve from there. */
  private folderOf(sourcePath: string): string | undefined {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return undefined;
    const parent = this.app.vault.getFileByPath(sourcePath)?.parent;
    return parent && !parent.isRoot() ? `${adapter.getBasePath()}/${parent.path}` : adapter.getBasePath();
  }
}
