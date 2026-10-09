# Code Block Kit

Format and run fenced code blocks in [Obsidian](https://obsidian.md) without leaving the note.

Each code block gets a format button and a run button, beside the copy button in Reading view and beside the language label in Live Preview. Two commands do the same from the keyboard, including in Source mode:

- **Format code block at cursor**
- **Run code block at cursor**

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

Running is available on desktop only.

| Language | Interpreter |
| --- | --- |
| Python | `python3` (`python` on Windows) |
| JavaScript | `node` |
| Shell | `bash`, `zsh` |

The interpreter must be installed. The plugin looks it up on the `PATH` of your login shell, so tools installed with Homebrew, nvm, or pyenv are found even when Obsidian is started from the Dock.

- Output streams into a panel under the block, with stderr in the error colour. The panel has stop, copy, and close buttons.
- The code runs from a temporary file, with the note's folder as the working directory.
- There is no stdin, a run is killed after 60 seconds, and output is cut off after 200,000 characters.

### Security

**Running a block executes it on your machine with your permissions. There is no sandbox.** Code never runs on its own: only when you press the run button or use the command. Only run code you understand.

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
npm run check   # typecheck and validate manifest, versions, changelog, and CSS
npm test        # fence parsing and formatter tests
```

Requires Node.js 22.18 or newer. Edit TypeScript under `src/`; `main.js` is build output and is not tracked.

## License

[MIT](LICENSE)
