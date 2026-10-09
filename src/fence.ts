/** A fenced code block located in a note's source lines. */
export interface Fence {
  /** Line index of the opening fence. */
  open: number;
  /** Line index of the last content line; equals `open` when the block is empty. */
  last: number;
  /** False when the block runs to the end of its container without a closing fence. */
  closed: boolean;
  /** First word of the info string, lowercased. */
  lang: string;
  /** Whatever precedes the fence on its line: list indentation and/or callout `>` markers. */
  prefix: string;
  /** Content with the prefix removed from every line. */
  code: string;
}

const OPENING = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})[ \t]*([^\s`{]*)(.*)$/;

/** Returns null when the line is no longer inside the block's callout. */
function unprefix(line: string, prefix: string): string | null {
  if (line.startsWith(prefix)) return line.slice(prefix.length);

  let rest = line;
  const depth = prefix.split(">").length - 1;
  for (let i = 0; i < depth; i++) {
    const marker = /^[ \t]*>/.exec(rest);
    if (!marker) return null;
    rest = rest.slice(marker[0].length);
  }
  // Usually a blank line: drop the indentation it does have, up to the prefix's.
  const indent = prefix.length - prefix.lastIndexOf(">") - 1;
  return rest.replace(/^[ \t]*/, (space) => space.slice(indent));
}

/** Finds every fenced code block that opens within `lines[from..to]`. */
export function parseFences(lines: string[], from = 0, to = lines.length - 1): Fence[] {
  const fences: Fence[] = [];
  const end = Math.min(to, lines.length - 1);

  for (let i = Math.max(from, 0); i <= end; i++) {
    const opening = OPENING.exec(lines[i] ?? "");
    if (!opening) continue;
    const prefix = opening[1] ?? "";
    const marker = opening[2] ?? "";
    // A backtick in the info string means inline code, not a fence.
    if (marker.startsWith("`") && (opening[4] ?? "").includes("`")) continue;

    const char = marker.startsWith("`") ? "`" : "~";
    const closing = new RegExp(`^ {0,3}${char}{${marker.length},}[ \\t]*$`);
    const body: string[] = [];
    let closed = false;
    let j = i + 1;
    for (; j <= end; j++) {
      const line = unprefix(lines[j] ?? "", prefix);
      if (line === null) break;
      if (closing.test(line)) {
        closed = true;
        break;
      }
      body.push(line);
    }

    fences.push({
      open: i,
      last: i + body.length,
      closed,
      lang: (opening[3] ?? "").toLowerCase(),
      prefix,
      code: body.join("\n"),
    });
    i = closed ? j : j - 1;
  }

  return fences;
}

/** Source lines for `code`, carrying the block's prefix again. */
export function withPrefix(fence: Fence, code: string): string[] {
  const blank = fence.prefix.trimEnd();
  return code.split("\n").map((line) => (line ? fence.prefix + line : blank));
}
