import { setIcon } from "obsidian";
import type { Stream } from "./run";

// Terminal colour and cursor sequences, which start with the escape character.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const LIMIT = 200_000;

/** Older Obsidian builds ship a Lucide set without some of the newer icon names. */
export function setButtonIcon(button: HTMLElement, icon: string): void {
  setIcon(button, icon);
  if (!button.childElementCount && icon === "wand-sparkles") setIcon(button, "wand");
}

/** The panel under a code block that shows a run's status and output. */
export class OutputPanel {
  readonly el = createDiv({ cls: "cbk-output" });
  private status: HTMLElement;
  private stop: HTMLElement;
  private body: HTMLElement;
  private size = 0;
  /** Output of the previous run, kept on screen until the new run has something to show. */
  private stale = false;

  constructor(onStop: () => void, onClose: () => void) {
    const bar = this.el.createDiv({ cls: "cbk-output-bar" });
    this.status = bar.createSpan({ cls: "cbk-output-status", text: "Running…" });
    this.stop = this.button(bar, "square", "Stop", onStop);
    this.button(bar, "x", "Close", onClose);
    this.body = this.el.createDiv({ cls: "cbk-output-body" });
  }

  private button(bar: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
    const button = bar.createEl("button", {
      cls: "cbk-output-button clickable-icon",
      attr: { type: "button", "aria-label": label },
    });
    setIcon(button, icon);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  /** Readies the panel for another run without collapsing it, so the note doesn't jump. */
  restart(): void {
    this.status.setText("Running…");
    this.stop.removeClass("cbk-hidden");
    this.el.removeClass("is-error");
    this.stale = this.size > 0;
    this.el.toggleClass("is-stale", this.stale);
  }

  private clearStale(): void {
    if (!this.stale) return;
    this.stale = false;
    this.el.removeClass("is-stale");
    this.body.empty();
    this.size = 0;
  }

  write(text: string, stream: Stream): void {
    this.clearStale();
    if (this.size >= LIMIT) return;
    const clean = text.replace(ANSI, "").slice(0, LIMIT - this.size);
    this.size += clean.length;
    this.body.createSpan({ cls: stream === "stderr" ? "cbk-stderr" : "", text: clean });
    if (this.size >= LIMIT) this.body.createSpan({ cls: "cbk-truncated", text: "\n… output truncated" });
    this.body.scrollTop = this.body.scrollHeight;
  }

  finish(summary: string, ok: boolean): void {
    this.clearStale();
    this.status.setText(summary);
    this.stop.addClass("cbk-hidden");
    this.el.toggleClass("is-error", !ok);
  }
}
