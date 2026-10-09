import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFences, withPrefix } from "../src/fence.ts";
import { canFormat, formatCode } from "../src/format.ts";

const parse = (source: string) => parseFences(source.split("\n"));

test("plain block", () => {
  const [fence, ...rest] = parse("intro\n```JS title\nconst a=1\n\nlet b\n```\noutro");
  assert.equal(rest.length, 0);
  assert.deepEqual(fence, {
    open: 1,
    last: 4,
    closed: true,
    lang: "js",
    prefix: "",
    code: "const a=1\n\nlet b",
  });
});

test("block inside a list keeps its indentation on the way back", () => {
  const [fence] = parse("- item\n    ```ts\n    if (a) {\n\n      b()\n    }\n    ```");
  assert.equal(fence?.code, "if (a) {\n\n  b()\n}");
  assert.deepEqual(withPrefix(fence!, "if (a) {\n\n  b();\n}"), [
    "    if (a) {",
    "",
    "      b();",
    "    }",
  ]);
});

test("block inside a callout", () => {
  const [fence, ...rest] = parse("> [!note]\n> ```json\n> {\"a\":1}\n>\n> ```\n> tail\n\n```js\nx\n```");
  assert.equal(fence?.code, '{"a":1}\n');
  assert.equal(fence?.closed, true);
  assert.deepEqual(withPrefix(fence!, "{ \"a\": 1 }\n"), ['> { "a": 1 }', ">"]);
  assert.equal(rest.length, 1);
  assert.equal(rest[0]?.open, 7);
});

test("unclosed block stops where its callout ends", () => {
  const [fence] = parse("> ```js\n> a\nplain");
  assert.equal(fence?.closed, false);
  assert.equal(fence?.last, 1);
});

test("longer fences, tildes, and inline triple backticks", () => {
  const fences = parse("````md\n```js\nx\n```\n````\n```not a fence``` text\n~~~yaml\na: 1\n~~~");
  assert.deepEqual(
    fences.map((fence) => [fence.lang, fence.code]),
    [
      ["md", "```js\nx\n```"],
      ["yaml", "a: 1"],
    ],
  );
});

test("range limits which fences are found", () => {
  const lines = "```js\na\n```\n\n```ts\nb\n```".split("\n");
  assert.deepEqual(parseFences(lines, 4, 6).map((fence) => fence.lang), ["ts"]);
});

test("formats every advertised language family", async () => {
  assert.equal(await formatCode("const a={b:1}", "js"), "const a = { b: 1 };");
  assert.equal(await formatCode("let a:number=1", "ts"), "let a: number = 1;");
  assert.equal(await formatCode("const a=<b>hi</b>", "tsx"), "const a = <b>hi</b>;");
  assert.equal(await formatCode('{"a":1,\n"b":[1,2]}', "json"), '{ "a": 1, "b": [1, 2] }');
  assert.equal(await formatCode("a{color:red}", "css"), "a {\n  color: red;\n}");
  assert.equal(await formatCode("<div><p>hi</p></div>", "html"), "<div><p>hi</p></div>");
  assert.equal(await formatCode("*  item", "md"), "- item");
  assert.equal(await formatCode("a:   1", "yaml"), "a: 1");
  assert.equal(await formatCode("{a{b}}", "graphql"), "{\n  a {\n    b\n  }\n}");
  assert.equal(
    await formatCode("<template><p>hi</p></template>\n<script>\nexport default {a:1}\n</script>", "vue"),
    "<template><p>hi</p></template>\n<script>\nexport default { a: 1 };\n</script>",
  );
});

test("unsupported languages and syntax errors", async () => {
  assert.equal(canFormat("python"), false);
  assert.equal(canFormat("constructor"), false);
  await assert.rejects(formatCode("const = ;", "js"));
});
