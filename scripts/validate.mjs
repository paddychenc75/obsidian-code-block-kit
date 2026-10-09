import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
    return {};
  }
}

const requiredFiles = [
  "manifest.json",
  "styles.css",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "versions.json",
  "package.json",
  "tsconfig.json",
  "esbuild.config.mjs",
  "src/main.ts",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail(`Missing required file: ${file}`);
}

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");
const releaseVersion = /^\d+\.\d+\.\d+$/;

for (const key of ["id", "name", "version", "minAppVersion", "author", "description"]) {
  if (typeof manifest[key] !== "string" || !manifest[key].trim()) {
    fail(`manifest.json must define a non-empty ${key}`);
  }
}

if (manifest.id !== "code-block-kit") {
  fail(`manifest id must be code-block-kit; received ${manifest.id}`);
}
if (manifest.name !== "Code Block Kit") {
  fail(`manifest name must be Code Block Kit; received ${manifest.name}`);
}
if (/obsidian|plugin/i.test(`${manifest.id} ${manifest.name}`)) {
  fail("manifest id and name must not contain Obsidian or Plugin");
}
if (/obsidian/i.test(manifest.description ?? "") || !/[.?!)]$/.test(manifest.description ?? "")) {
  fail("manifest description must not mention Obsidian and must end with punctuation");
}
// Formatting works on mobile; running is switched off there at runtime instead.
if (manifest.isDesktopOnly !== false) {
  fail("manifest isDesktopOnly must be false");
}
if (!releaseVersion.test(manifest.version ?? "")) {
  fail(`manifest version must use the x.y.z release format: ${manifest.version}`);
}
if (!releaseVersion.test(manifest.minAppVersion ?? "")) {
  fail(`manifest minAppVersion must use the x.y.z format: ${manifest.minAppVersion}`);
}
if (pkg.version !== manifest.version) {
  fail(`package.json version ${pkg.version} does not match manifest ${manifest.version}`);
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  fail(`versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}`);
}

const changelog = existsSync(resolve(root, "CHANGELOG.md")) ? read("CHANGELOG.md") : "";
if (!changelog.includes(`## ${manifest.version}`)) {
  fail(`CHANGELOG.md has no entry for ${manifest.version}`);
}

const styles = existsSync(resolve(root, "styles.css")) ? read("styles.css") : "";
const stylesWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, "");
if (/!important/.test(stylesWithoutComments)) fail("styles.css must not use !important");
if (/:has\(/.test(stylesWithoutComments)) fail("styles.css must not use :has()");
const ownClasses = [...stylesWithoutComments.matchAll(/\.(cbk-[a-z0-9-]+)/g)].length;
if (ownClasses === 0) fail("styles.css defines no cbk-* classes");

// Node built-ins must stay behind a call, or the plugin fails to load on mobile.
for (const file of ["src/main.ts", "src/live.ts", "src/output.ts", "src/place.ts", "src/fence.ts", "src/format.ts", "src/run.ts"]) {
  if (!existsSync(resolve(root, file))) continue;
  const source = read(file);
  const topLevelNode = source.match(/^import (?!type\b).*from "(?:node:)?(child_process|fs|os|path)";$/m);
  if (topLevelNode) fail(`${file} imports "${topLevelNode[1]}" at the top level; load it with a guarded dynamic import()`);
  const filesystem = source.match(/import\("(?:node:)?(fs|os|path)"\)|require\("(?:node:)?(fs|os|path)"\)/);
  if (filesystem) fail(`${file} loads "${filesystem[1] ?? filesystem[2]}"; code goes to the interpreter over stdin`);
  if (/\.style\.[a-zA-Z]+\s*=[^=]/.test(source)) fail(`${file} assigns el.style.*; use classes or setCssProps`);
}

// Obsidian's review rejects bundles with hex-style identifiers as obfuscated. A dependency can
// bring them in: the TypeScript compiler has `..._between_0x0_and_0x10FFFF_...`.
if (existsSync(resolve(root, "main.js")) && /_0x[0-9a-fA-F]/.test(read("main.js"))) {
  fail("main.js contains _0x identifiers, which the plugin review flags as obfuscation");
}

const readme = existsSync(resolve(root, "README.md")) ? read("README.md") : "";
if (/\/Users\/|[A-Z]:\\Users\\/i.test(readme)) {
  fail("README.md contains a machine-specific absolute path");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${manifest.name} ${manifest.version}: ${requiredFiles.length} required files.`);
