import { type EditorState, StateField } from "@codemirror/state";
// The extension lets Node load this module directly in the tests.
import { type Fence, parseFences } from "./fence.ts";

/** The note's fenced blocks, parsed once per change and shared by every editor feature. */
export const fencesField = StateField.define<Fence[]>({
  create: (state) => parseFences(state.doc.toJSON()),
  update: (fences, tr) => (tr.docChanged ? parseFences(tr.newDoc.toJSON()) : fences),
});

/** One line of code inside a block, without its list indentation or callout markers. */
export interface CodeLine {
  fence: Fence;
  /** Document position where the code starts, after the prefix. */
  from: number;
  /** Document position of the end of the line. */
  to: number;
  text: string;
}

/** The code on document line `number` (1-based), or null when that line is not inside a block. */
export function codeLineAt(state: EditorState, number: number): CodeLine | null {
  const index = number - 1;
  const fence = state.field(fencesField).find((candidate) => index > candidate.open && index <= candidate.last);
  if (!fence) return null;
  const line = state.doc.line(number);
  const text = fence.code.split("\n")[index - fence.open - 1] ?? "";
  return { fence, from: line.to - text.length, to: line.to, text };
}

/** Every code line the range touches, or null unless they all belong to one block. */
export function codeLinesIn(state: EditorState, from: number, to: number): CodeLine[] | null {
  const first = state.doc.lineAt(from).number;
  const last = state.doc.lineAt(to).number;
  const lines: CodeLine[] = [];
  for (let number = first; number <= last; number++) {
    const line = codeLineAt(state, number);
    if (!line || (lines[0] && line.fence !== lines[0].fence)) return null;
    lines.push(line);
  }
  return lines;
}

const WIDE = new Set(["python", "py", "java", "c", "cpp", "cs", "csharp", "go", "rust", "rs", "kotlin", "swift", "php"]);

/** What one level of indentation is in this block: what its code already uses, else a default. */
export function indentUnit(fence: Fence): string {
  let spaces = 0;
  for (const line of fence.code.split("\n")) {
    const indent = /^[ \t]+/.exec(line)?.[0];
    if (!indent) continue;
    if (indent.startsWith("\t")) return "\t";
    if (!spaces || indent.length < spaces) spaces = indent.length;
  }
  return " ".repeat(Math.min(spaces, 8) || (WIDE.has(fence.lang) ? 4 : 2));
}
