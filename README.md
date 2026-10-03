# Noveler

A distraction-free Markdown editor built for fiction writers. Desktop app built with **Tauri 2** (Rust) + **React 19** + **TipTap 3**.

## Features

- WYSIWYG Markdown editing with smart typography (curly quotes, em-dashes, ellipses)
- Editor / split / preview modes with book-style preview typesetting
- Light, dark and sepia themes
- Project folder sidebar for chapter files
- Export to Word (`.docx`, standard manuscript formatting) and Print / PDF
- **Data safety**
  - Autosave (1.5 s after you stop typing) for files that have a location on disk
  - Unsaved-changes prompt before New / Open / switching files / closing the window
  - Crash recovery: unsaved work (including *Untitled* documents) is restored on next launch
  - Atomic saves: a crash mid-save can't corrupt a chapter
  - Rolling backups: `<folder>/.noveler/backups/<file>/` keeps the last 20 versions (at most one per 10 minutes)

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New document |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+P` | Print / Save as PDF |
| `Ctrl+Shift+D` | Cycle theme |

## Development

Prerequisites: Node.js 22+, Rust 1.90+, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
npm run dev            # browser-only UI (limited: no direct file access)
npm run tauri build    # production installer in src-tauri/target/release/bundle
```

### Quality checks

```bash
npm run check          # typecheck + lint + unit tests
npm run test           # Vitest unit tests
npm run test:rust      # Rust unit tests (file commands, backups)
npm run format         # Prettier
```

## Project layout

```
src/
  components/   Toolbar, Sidebar, Editor (TipTap), Preview, StatusBar
  stores/       Zustand store: document state + file actions
  services/     fileService (Tauri IPC + dialogs), recovery (crash snapshots)
  hooks/        keyboard shortcuts, app lifecycle (close guard, drag-drop, recovery)
  export/       docx + print/PDF
  utils/        markdown <-> HTML conversion (sanitized)
src-tauri/
  src/commands.rs   read_file / write_file / write_binary_file / read_dir
```

## Security notes

- All Markdown→HTML output is sanitized with DOMPurify, and production builds run under a strict CSP.
- The native file commands only read/write `.md`, `.markdown`, `.txt` (and write `.docx` exports), and refuse relative paths.

## Known limitations

See the improvement roadmap. Notably, the Markdown round-trip can still rewrite some
constructs on save (soft line breaks, escaped punctuation, text alignment). Fixing this is next on the roadmap.
