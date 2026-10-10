# Code Block Kit

Format and run fenced code blocks in [Obsidian](https://obsidian.md) without leaving the note.

Each code block gets a format button and a run button, beside the copy button in Reading view and beside the language label in Live Preview. They are always visible, and in Reading view the copy button stays visible beside them instead of appearing on hover. Two commands do the same from the keyboard, including in Source mode:

- **Format current code block**
- **Run current code block**

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

### Security

Code never runs on its own: only when you press the run button or use the command. Only run code you understand.

**The worker is not a sandbox on desktop.** The desktop app gives workers Node.js, so a block can call `require("fs")` or start other programs, with your permissions. On mobile there is no Node.js, and a block is limited to what a web page can do, which includes network requests.

## Disclosures

- **The plugin makes no network requests, and has no telemetry or accounts.** Code you run can make its own.
- **The plugin starts no programs and reads or writes no files outside the vault.** Code you run on desktop can, as described under Security.
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
npm test        # fence parsing and formatter tests
```

Requires Node.js 22.18 or newer. Edit TypeScript under `src/`; `main.js` is build output and is not tracked.

## License

[MIT](LICENSE)
