# Changelog

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
