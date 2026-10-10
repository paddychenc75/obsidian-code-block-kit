import { FileSystemAdapter, Notice, Platform, Plugin } from "obsidian";

/** File extensions for languages whose name isn't already one. */
const EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  ruby: "rb",
  rust: "rs",
  golang: "go",
  kotlin: "kt",
  csharp: "cs",
  "c#": "cs",
  "c++": "cpp",
  shell: "sh",
  bash: "sh",
  zsh: "sh",
  powershell: "ps1",
  markdown: "md",
  yaml: "yml",
  haskell: "hs",
  perl: "pl",
  text: "txt",
};

/** Opening an external editor needs a real file on disk, which only the desktop app has. */
export function canOpen(lang: string): boolean {
  return Platform.isDesktopApp && lang !== "";
}

function extensionFor(lang: string): string {
  const known = EXTENSIONS[lang] ?? lang;
  return /^[a-z0-9]+$/.test(known) ? known : "txt";
}

/**
 * Saves `code` as a file in the plugin's own folder and opens it in VS Code, so it can be run
 * there with the tools installed on the computer. Each language has one file, written over every
 * time; edits made in VS Code do not come back to the note.
 */
export async function openInVsCode(plugin: Plugin, code: string, lang: string): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    new Notice("Opening code in VS Code needs the desktop app.");
    return;
  }

  const folder = `${plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`}/snippets`;
  const path = `${folder}/snippet.${extensionFor(lang)}`;
  if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
  await adapter.write(path, code.endsWith("\n") ? code : `${code}\n`);

  // vscode://file/<absolute path>, with every segment escaped but a Windows drive's colon kept.
  const absolute = `${adapter.getBasePath()}/${path}`.replace(/\\/g, "/");
  const escaped = absolute
    .split("/")
    .map((segment, index) => (index === 0 && /^[a-zA-Z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
    .join("/");
  window.open(`vscode://file${escaped.startsWith("/") ? "" : "/"}${escaped}`);
}
