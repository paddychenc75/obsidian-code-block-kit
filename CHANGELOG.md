# Changelog

## 0.1.0

First release.

Added

- Format button and **Format current code block** command, using a bundled Prettier: JavaScript, JSX, TypeScript, TSX, JSON, JSONC, JSON5, CSS, SCSS, Less, HTML, Vue, Markdown, YAML, and GraphQL
- Run button and **Run current code block** command on desktop: Python, JavaScript, TypeScript, and shell, with streamed output, a stop button, a 60 second timeout, and a 200,000 character output limit
- Buttons in both Reading view and Live Preview, lined up beside the copy button or the language label
- Blocks nested in lists and callouts keep their indentation and `>` markers when formatted
- Running a block again reuses its output panel and keeps the previous output on screen until the new run produces some, so the note does not jump
- In Reading view, the copy button stays visible on blocks that have these buttons, so there is no empty slot beside them
