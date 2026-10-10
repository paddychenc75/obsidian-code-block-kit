# Changelog

## 0.2.2

Fixed

- With a theme that puts the Live Preview language label on the left of a code block, the buttons followed it and ended up outside the block. They now stay in the right corner in that case, and still sit beside the label when it is on the right

## 0.2.1

Changed

- The format and run buttons appear only while the pointer is on the block, and have an opaque background, so they no longer sit on top of a long first line. On touch screens they are always shown
- Reading view no longer forces the copy button to stay visible; it is back to the theme's own behaviour

## 0.2.0

Running code no longer starts anything outside Obsidian.

Changed

- JavaScript and TypeScript blocks run in a Web Worker inside Obsidian instead of in a separate `node` process. No interpreter needs to be installed, and running works on mobile too
- Blocks run as ES modules, so `import` and top-level `await` work. A run ends when the block has finished and no timer is pending
- The panel reports `Finished` or `Failed` instead of an exit code

Removed

- Running Python blocks, which needed a local interpreter
- Everything that used Node: the plugin no longer loads `child_process` or starts a login shell to read `PATH`

## 0.1.4

Removed

- The copy button on the output panel, so the plugin no longer touches the clipboard. Select the output and copy it as usual

## 0.1.3

Removed

- Running shell blocks (`sh`, `bash`, `shell`, `zsh`). Python, JavaScript, and TypeScript blocks still run

## 0.1.2

Changed

- Code is piped to the interpreter instead of being saved to a temporary file first, so the plugin no longer touches the filesystem outside the vault API

## 0.1.1

Changed

- TypeScript and TSX are formatted with Babel's TypeScript parser instead of the TypeScript compiler. The bundle drops from 2.3 MB to 1.4 MB, and no longer contains the compiler's `..._between_0x0_and_0x10FFFF_...` diagnostic names, which the plugin review read as obfuscated code

## 0.1.0

First release.

Added

- Format button and **Format current code block** command, using a bundled Prettier: JavaScript, JSX, TypeScript, TSX, JSON, JSONC, JSON5, CSS, SCSS, Less, HTML, Vue, Markdown, YAML, and GraphQL
- Run button and **Run current code block** command on desktop: Python, JavaScript, TypeScript, and shell, with streamed output, a stop button, a 60 second timeout, and a 200,000 character output limit
- Buttons in both Reading view and Live Preview, lined up beside the copy button or the language label
- Blocks nested in lists and callouts keep their indentation and `>` markers when formatted
- Running a block again reuses its output panel and keeps the previous output on screen until the new run produces some, so the note does not jump
- In Reading view, the copy button stays visible on blocks that have these buttons, so there is no empty slot beside them
