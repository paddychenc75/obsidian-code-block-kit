import { ChangeSpec, EditorSelection, Prec } from "@codemirror/state";
import { EditorView, KeyBinding, keymap } from "@codemirror/view";
import { Diagnostic, linter } from "@codemirror/lint";
import { codeLineAt, codeLinesIn, fencesField, indentUnit } from "./blocks";
import { canFormat, syntaxError } from "./format";

const CLOSERS: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
const COLON_BLOCKS = new Set(["python", "py", "yaml", "yml"]);

/** Enter keeps the line's indentation, and adds a level after an opening bracket. */
function newline(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || !range.empty) return false;
  const line = codeLineAt(state, state.doc.lineAt(range.head).number);
  if (!line || range.head < line.from) return false;

  const before = line.text.slice(0, range.head - line.from);
  const after = line.text.slice(range.head - line.from);
  const indent = /^[ \t]*/.exec(before)?.[0] ?? "";
  const opener = /([{[(])\s*$/.exec(before)?.[1];
  const deeper = !!opener || (COLON_BLOCKS.has(line.fence.lang) && /:\s*$/.test(before));
  const prefix = line.fence.prefix;

  let insert = `\n${prefix}${indent}${deeper ? indentUnit(line.fence) : ""}`;
  const cursor = range.head + insert.length;
  // Between a pair of brackets, the closing one goes on its own line below the cursor.
  if (opener && after.trimStart().startsWith(CLOSERS[opener] ?? "")) insert += `\n${prefix}${indent}`;

  view.dispatch({
    changes: { from: range.head, to: range.head + (after.length - after.trimStart().length), insert },
    selection: EditorSelection.cursor(cursor),
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

/** Tab indents the selected lines, or moves a lone cursor to the next indent stop. */
function indent(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1) return false;
  const lines = codeLinesIn(state, range.from, range.to);
  const first = lines?.[0];
  if (!lines || !first || range.from < first.from) return false;
  const unit = indentUnit(first.fence);

  if (range.empty) {
    const column = range.head - first.from;
    const insert = unit === "\t" ? unit : " ".repeat(unit.length - (column % unit.length));
    view.dispatch(state.replaceSelection(insert), { scrollIntoView: true, userEvent: "input.indent" });
    return true;
  }
  const changes = lines.filter((line) => line.text.trim()).map((line) => ({ from: line.from, insert: unit }));
  view.dispatch({ changes, userEvent: "input.indent" });
  return true;
}

function dedent(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1) return false;
  const lines = codeLinesIn(state, range.from, range.to);
  if (!lines?.[0]) return false;
  const unit = indentUnit(lines[0].fence);

  const changes: ChangeSpec[] = [];
  for (const line of lines) {
    const leading = /^[ \t]*/.exec(line.text)?.[0] ?? "";
    const remove = leading.startsWith("\t") ? 1 : Math.min(leading.length, unit === "\t" ? 4 : unit.length);
    if (remove) changes.push({ from: line.from, to: line.from + remove });
  }
  // Still handled when there is nothing to remove, so Shift-Tab never outdents the list around it.
  if (changes.length) view.dispatch({ changes, userEvent: "delete.dedent" });
  return true;
}

interface CommentStyle {
  open: string;
  close?: string;
}

const SLASHES: CommentStyle = { open: "//" };
const HASH: CommentStyle = { open: "#" };
const DASHES: CommentStyle = { open: "--" };
const MARKUP: CommentStyle = { open: "<!--", close: "-->" };
const COMMENTS: Record<string, CommentStyle> = {
  css: { open: "/*", close: "*/" },
  ...Object.fromEntries(
    "js javascript mjs cjs jsx ts typescript mts cts tsx jsonc json5 scss less java c cpp h hpp cs csharp go rust rs swift kotlin kt php dart scala groovy"
      .split(" ")
      .map((lang) => [lang, SLASHES]),
  ),
  ...Object.fromEntries(
    "python py sh bash zsh shell fish yaml yml toml ruby rb r perl dockerfile makefile powershell ps1 nginx graphql gql ini conf"
      .split(" ")
      .map((lang) => [lang, HASH]),
  ),
  ...Object.fromEntries("sql lua haskell hs elm ada".split(" ").map((lang) => [lang, DASHES])),
  ...Object.fromEntries("html htm xml svg vue md markdown".split(" ").map((lang) => [lang, MARKUP])),
};

/**
 * Comments the selected lines in the block's own language, or uncomments them if they all are.
 * Returns false, changing nothing, outside a block or in a language without a known comment.
 * With `check` it only reports whether it would act.
 */
export function toggleComment(view: EditorView, check = false): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1) return false;
  const lines = codeLinesIn(state, range.from, range.to)?.filter((line) => line.text.trim());
  const style = lines?.[0] ? COMMENTS[lines[0].fence.lang] : undefined;
  if (!lines?.length || !style) return false;
  if (check) return true;
  const { open, close } = style;

  const leading = (text: string): number => text.length - text.trimStart().length;
  const commented = (text: string): boolean =>
    text.trimStart().startsWith(open) && (!close || text.trimEnd().endsWith(close));
  const changes: ChangeSpec[] = [];

  if (lines.every((line) => commented(line.text))) {
    for (const line of lines) {
      const start = line.from + leading(line.text);
      const space = line.text.charAt(leading(line.text) + open.length) === " " ? 1 : 0;
      changes.push({ from: start, to: start + open.length + space });
      if (close) {
        const end = line.from + line.text.trimEnd().length;
        const gap = line.text.trimEnd().charAt(line.text.trimEnd().length - close.length - 1) === " " ? 1 : 0;
        changes.push({ from: end - close.length - gap, to: end });
      }
    }
  } else {
    // All at the shallowest indentation, so the markers line up and nested code keeps its shape.
    const column = Math.min(...lines.map((line) => leading(line.text)));
    for (const line of lines) {
      changes.push({ from: line.from + column, insert: `${open} ` });
      if (close) changes.push({ from: line.from + line.text.trimEnd().length, insert: ` ${close}` });
    }
  }
  view.dispatch({ changes, userEvent: "input.comment" });
  return true;
}

/** A closing bracket typed on an otherwise empty line steps back one level to meet its opener. */
const closeBracket = EditorView.inputHandler.of((view, from, to, text) => {
  if (from !== to || text.length !== 1 || !"}])".includes(text)) return false;
  const line = codeLineAt(view.state, view.state.doc.lineAt(from).number);
  if (!line || from < line.from) return false;
  const before = line.text.slice(0, from - line.from);
  if (!before || before.trim()) return false;

  const unit = indentUnit(line.fence);
  const remove = before.endsWith("\t") ? 1 : Math.min(before.length, unit === "\t" ? 4 : unit.length);
  view.dispatch({
    changes: { from: from - remove, to, insert: text },
    selection: EditorSelection.cursor(from - remove + 1),
    userEvent: "input.type",
  });
  return true;
});

/** Underlines the first syntax error in each block whose language the formatter can parse. */
const syntaxLinter = linter(
  async (view) => {
    const { doc } = view.state;
    const diagnostics: Diagnostic[] = [];
    for (const fence of view.state.field(fencesField)) {
      if (!canFormat(fence.lang) || !fence.code.trim() || fence.code.length > 20_000) continue;
      const error = await syntaxError(fence.code, fence.lang);
      if (!error) continue;

      const index = Math.min(fence.open + Math.max(error.line, 1), fence.last);
      const line = doc.line(index + 1);
      const text = fence.code.split("\n")[index - fence.open - 1] ?? "";
      let from = Math.min(line.to - text.length + Math.max(error.column - 1, 0), line.to);
      const to = Math.min(from + 1, line.to);
      if (from === to && from > line.from) from -= 1;
      diagnostics.push({ from, to, severity: "error", message: error.message });
    }
    return diagnostics;
  },
  { delay: 600 },
);

const keys: KeyBinding[] = [
  { key: "Enter", run: newline },
  { key: "Tab", run: indent, shift: dedent },
  // Reached only when Obsidian's own comment command has no hotkey; see main.ts for when it has.
  { key: "Mod-/", run: (view) => toggleComment(view) },
];

/** Editing inside code blocks: indentation, comments in the block's language, and syntax errors. */
export const codeEditing = [Prec.high(keymap.of(keys)), closeBracket, syntaxLinter];
