# Code Block Kit

Obsidian plugin that formats and runs fenced code blocks in place.

## Language

- Everything in the repository is written in English: code, comments, commit messages, tags, release notes, `README.md`, and `CHANGELOG.md`.
- Follow the existing commit subject style, for example `Add Code Block Kit 0.1.0: format and run code blocks in Reading view and Live Preview.`

## Workflow

- Edit TypeScript under `src/`. `main.js` is build output and is not tracked; the release workflow builds it.
- `npm run build` typechecks and bundles. `npm run check` typechecks, lints with Obsidian's own `eslint-plugin-obsidianmd` rules, and validates the manifest, versions, changelog, and CSS rules. `npm test` covers fence parsing and the formatter. Run all three before committing.
- To try a build, copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/code-block-kit/` and reload the plugin.
- To release: set the version in `package.json`, run `npm run version` to sync `manifest.json` and `versions.json`, add a `CHANGELOG.md` entry, then push a tag named after the version. The tag triggers `.github/workflows/release.yml`.

## Layout

- `src/fence.ts` finds fenced blocks in source lines and puts list and callout prefixes back. It has no Obsidian imports, so it is tested directly.
- `src/format.ts` maps languages to Prettier parsers. `src/run.ts` maps languages to interpreters and owns the child process.
- `src/main.ts` holds the Reading view buttons and the commands. `src/live.ts` holds the Live Preview buttons and the output panel decoration.
- `src/place.ts` positions the buttons in both views; `src/output.ts` is the output panel.

## Constraints

- `isDesktopOnly` stays `false`: formatting works on mobile. The only Node built-in is `child_process`, loaded with a dynamic `import()` inside `nodeModules()` in `src/run.ts`, behind a `Platform.isDesktop` guard, so the plugin still loads there.
- Running code is never automatic. It starts only from a button press or a command.
- Code reaches the interpreter over stdin. Do not add `fs`, `os`, or `path`: the plugin review reports direct filesystem access, and nothing here needs it.
- The buttons look the same in Reading view and Live Preview. They are measured against Obsidian's own copy button or language label rather than sharing its classes.
- `styles.css` uses Obsidian's variables only, with no `:has()` and no `!important`. All classes are prefixed `cbk-`.
- No `el.style.*` assignments; use classes or `setCssProps`.
- Never write to a note from stale positions: Reading view compares the block's lines with the file before writing, and the editor path compares the range before replacing it.
