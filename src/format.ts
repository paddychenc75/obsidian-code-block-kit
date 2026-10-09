import type { Plugin as PrettierPlugin } from "prettier";

type Load = () => Promise<unknown>;

// Dynamic imports keep each parser unevaluated until a block in that language is formatted.
const babel: Load = () => import("prettier/plugins/babel");
const estree: Load = () => import("prettier/plugins/estree");
const postcss: Load = () => import("prettier/plugins/postcss");
const html: Load = () => import("prettier/plugins/html");
const markdown: Load = () => import("prettier/plugins/markdown");
const yaml: Load = () => import("prettier/plugins/yaml");
const graphql: Load = () => import("prettier/plugins/graphql");

interface Target {
  parser: string;
  plugins: Load[];
}

const script: Target = { parser: "babel", plugins: [babel, estree] };
// Babel parses TypeScript too, which saves bundling the TypeScript compiler: half the bundle,
// and its diagnostic names (`..._between_0x0_and_0x10FFFF_...`) trip obfuscation scanners.
const typed: Target = { parser: "babel-ts", plugins: [babel, estree] };
// Vue and HTML ask for the "typescript" parser by name for `lang="ts"` scripts.
const typescriptAlias: Load = async () => {
  const { parsers } = await import("prettier/plugins/babel");
  return { parsers: { typescript: parsers["babel-ts"] } };
};
const markup: Load[] = [html, babel, estree, postcss, typescriptAlias];

const TARGETS: Record<string, Target> = {
  js: script,
  javascript: script,
  mjs: script,
  cjs: script,
  jsx: script,
  ts: typed,
  typescript: typed,
  mts: typed,
  cts: typed,
  tsx: typed,
  json: { parser: "json", plugins: [babel, estree] },
  jsonc: { parser: "jsonc", plugins: [babel, estree] },
  json5: { parser: "json5", plugins: [babel, estree] },
  css: { parser: "css", plugins: [postcss] },
  scss: { parser: "scss", plugins: [postcss] },
  less: { parser: "less", plugins: [postcss] },
  html: { parser: "html", plugins: markup },
  htm: { parser: "html", plugins: markup },
  vue: { parser: "vue", plugins: markup },
  md: { parser: "markdown", plugins: [markdown] },
  markdown: { parser: "markdown", plugins: [markdown] },
  yaml: { parser: "yaml", plugins: [yaml] },
  yml: { parser: "yaml", plugins: [yaml] },
  graphql: { parser: "graphql", plugins: [graphql] },
  gql: { parser: "graphql", plugins: [graphql] },
};

export function canFormat(lang: string): boolean {
  return Object.prototype.hasOwnProperty.call(TARGETS, lang);
}

/** Formats `code` and returns it without a trailing newline. Throws on a syntax error. */
export async function formatCode(code: string, lang: string): Promise<string> {
  const target = TARGETS[lang];
  if (!target) throw new Error(`No formatter for "${lang}"`);

  const [prettier, ...plugins] = await Promise.all([
    import("prettier/standalone"),
    ...target.plugins.map((load) => load()),
  ]);
  const formatted = await prettier.format(code, {
    parser: target.parser,
    plugins: plugins as PrettierPlugin[],
  });
  return formatted.replace(/\n+$/, "");
}
