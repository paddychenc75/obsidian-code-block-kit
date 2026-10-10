import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorState } from "@codemirror/state";
import { codeLineAt, codeLinesIn, fencesField, indentUnit } from "../src/blocks.ts";
import { parseFences } from "../src/fence.ts";
import { syntaxError } from "../src/format.ts";

const stateOf = (doc: string) => EditorState.create({ doc, extensions: [fencesField] });
const fenceOf = (source: string) => parseFences(source.split("\n"))[0]!;

test("code lines exclude the fences and the container prefix", () => {
  const state = stateOf("text\n> ```js\n> const a = 1\n>\n>   b()\n> ```\nafter");
  assert.equal(codeLineAt(state, 1), null);
  assert.equal(codeLineAt(state, 2), null, "opening fence");
  assert.equal(codeLineAt(state, 6), null, "closing fence");

  const first = codeLineAt(state, 3)!;
  assert.equal(first.text, "const a = 1");
  assert.equal(state.sliceDoc(first.from, first.to), "const a = 1");

  const blank = codeLineAt(state, 4)!;
  assert.equal(blank.text, "");
  assert.equal(blank.from, blank.to);

  assert.equal(codeLineAt(state, 5)!.text, "  b()");
});

test("a range must stay inside one block", () => {
  const state = stateOf("```js\na\nb\n```\n\n```js\nc\n```");
  const pos = (line: number) => state.doc.line(line).from;
  assert.deepEqual(codeLinesIn(state, pos(2), pos(3))!.map((line) => line.text), ["a", "b"]);
  assert.equal(codeLinesIn(state, pos(2), pos(4)), null, "reaches the closing fence");
  assert.equal(codeLinesIn(state, pos(3), pos(7)), null, "spans two blocks");
});

test("indent unit follows the block, then the language", () => {
  assert.equal(indentUnit(fenceOf("```js\nif (a) {\n    b()\n        c()\n}\n```")), "    ");
  assert.equal(indentUnit(fenceOf("```js\nif (a) {\n\tb()\n}\n```")), "\t");
  assert.equal(indentUnit(fenceOf("```js\na\n```")), "  ");
  assert.equal(indentUnit(fenceOf("```python\na\n```")), "    ");
});

test("syntax errors carry a position within the code", async () => {
  assert.equal(await syntaxError("const a = 1;", "js"), null);
  assert.deepEqual(await syntaxError("const a = 1;\nconst = ;", "js"), {
    line: 2,
    column: 7,
    message: "Unexpected token",
  });
  const json = await syntaxError('{"a": }', "json");
  assert.equal(json?.line, 1);
  const css = await syntaxError("a { color: red", "css");
  assert.equal(css?.line, 1);
  assert.equal((await syntaxError("a: [1, 2", "yaml"))?.line, 1);
});
