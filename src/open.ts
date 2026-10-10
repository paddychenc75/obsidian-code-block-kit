import { addIcon, FileSystemAdapter, Notice, Platform, Plugin } from "obsidian";

export const VS_CODE_ICON = "cbk-vs-code";

/**
 * The VS Code mark, from Simple Icons (CC0). Obsidian's icons are drawn on a 100 by 100 canvas
 * and this path on 24 by 24, so it is scaled up, slightly inset because a solid shape reads
 * heavier than the outline icons beside it.
 */
export function registerVsCodeIcon(): void {
  addIcon(
    VS_CODE_ICON,
    '<path fill="currentColor" stroke="none" transform="translate(9 9) scale(3.4167)" d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>',
  );
}

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
