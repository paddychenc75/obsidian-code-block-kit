# Code Block Kit

Format, run, and edit fenced code blocks in [Obsidian](https://obsidian.md) without leaving the note.

Each code block gets buttons to format it, run it, and open it in VS Code, beside the copy button in Reading view and beside the language label in Live Preview. They are always visible, and in Reading view the copy button stays visible beside them instead of appearing on hover. Three commands do the same from the keyboard, including in Source mode:

- **Format current code block**
- **Run current code block**
- **Open current code block in VS Code**

## Edit

While the cursor is inside a code block in the editor:

| Key | What it does |
| --- | --- |
| `Enter` | Keeps the indentation, adds a level after `{`, `[`, `(` (and `:` in Python and YAML), and splits a bracket pair onto three lines |
| `Tab` / `Shift+Tab` | Indents or outdents the selected lines, using the indentation the block already has |
| `}` `]` `)` | Typed on an empty line, steps back one level |
| Toggle comment (`Ctrl/Cmd+/`) | Comments in the block's language: `//`, `#`, `--`, `/* */`, or `<!-- -->` |

The first syntax error in a block is underlined, with the message on hover, for the languages listed under Format.

Blocks inside lists and callouts work the same way: the list indentation and `>` markers are kept on every new line.

Toggle comment works by wrapping Obsidian's own **Toggle comment** command, so it follows whatever hotkey you gave that command. Outside code blocks, and in languages the plugin has no comment syntax for, the command behaves as it always did.

## Format

Formatting uses [Prettier](https://prettier.io), bundled with the plugin, so it works offline and on mobile.

| Family | Languages |
| --- | --- |
| Scripts | JavaScript, JSX, TypeScript, TSX |
| Data | JSON, JSONC, JSON5, YAML, GraphQL |
| Styles | CSS, SCSS, Less |
| Markup | HTML, Vue, Markdown |

Blocks nested in lists and callouts keep their indentation and `>` markers.

## Run

JavaScript and TypeScript blocks run inside Obsidian, in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API). Nothing has to be installed, and it works on desktop and mobile.

- Blocks run as ES modules: `import` from a URL and top-level `await` work.
- TypeScript is stripped of its types first; it is not type-checked.
- `console.log`, `info`, and `debug` go to the output panel under the block, `warn` and `error` in the error colour. An uncaught error is shown with its line number.
- A run ends when the block has finished and no timer is pending. The panel has stop and close buttons, its text can be selected and copied, and running the block again reuses it.
- A run is stopped after 60 seconds, and output is cut off after 200,000 characters.

## Open in VS Code

On desktop, a block in any language has an **Open in VS Code** button, and there is an **Open current code block in VS Code** command. Use it for code that needs a real environment: Python with your packages, Go, Rust, shell scripts.

- The block is saved to `snippets/snippet.<ext>` inside the plugin's own folder in the vault, and VS Code opens that file through a `vscode://` link. VS Code must be installed.
- Each language has one file, written over every time you open a block in that language.
- It is one way: the plugin does not run the code, and edits you make in VS Code do not come back to the note.

### Security

Code never runs on its own: only when you press the run button or use the command. Only run code you understand.

**The worker is not a sandbox on desktop.** The desktop app gives workers Node.js, so a block can call `require("fs")` or start other programs, with your permissions. On mobile there is no Node.js, and a block is limited to what a web page can do, which includes network requests.

## Disclosures

- **The plugin makes no network requests, and has no telemetry or accounts.** Code you run can make its own.
- **The plugin reads and writes no files outside the vault.** Open in VS Code saves a copy of the block inside the plugin's folder in the vault. Code you run on desktop can reach other files, as described under Security.
- **The only program the plugin starts is VS Code**, when you ask it to open a block, by opening a `vscode://` link.
- **No clipboard access.** The plugin neither reads nor writes the clipboard.
- Formatting changes only the code block you format, in the note it belongs to.

## Installation

The plugin is not in the community plugin list yet. To install it by hand:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<vault>/.obsidian/plugins/code-block-kit/`.
3. Enable **Code Block Kit** under Settings → Community plugins.

## Development

```sh
npm install
npm run dev     # watch build
npm run build   # typecheck and bundle to main.js
npm run check   # typecheck, lint, and validate manifest, versions, changelog, and CSS
npm test        # fence parsing, formatter, and editing tests
```

Requires Node.js 22.18 or newer. Edit TypeScript under `src/`; `main.js` is build output and is not tracked.

## License

[MIT](LICENSE)
