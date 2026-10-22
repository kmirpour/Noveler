# Noveler

A distraction-free, professional Markdown desktop studio built specifically for fiction novelists and long-form storytellers.

Built with **Tauri 2** (Rust) + **React 19** + **TipTap 3** + **Vite**.

---

## Overview

Unlike general-purpose text editors and code editors that treat documents as isolated files, **Noveler** treats your novel folder as a unified manuscript. It combines the distraction-free purity of plain Markdown with the specialized tools novelists need: sequential chapter management, book-style typesetting, real-time hashtag narrative tracking, an integrated scratchpad, industry-standard Shunn manuscript compilation, and bulletproof data safety.

All chapter files remain **100% clean, standard Markdown** on disk—no proprietary formats, no injected YAML frontmatter, and zero vendor lock-in.

---

## Key Capabilities

### 📖 Novel-as-a-Folder Architecture
- **Flat Chapter Structure**: All chapters reside directly in your novel's folder as clean `.md` files (`01-chapter.md`, `02-the-beginning.md`).
- **Sequential Auto-Numbering**: New chapters (`Ctrl+N`) automatically detect the next sequential prefix.
- **Natural Numerical Sorting**: Chapters appear in ascending narrative order in the sidebar.
- **Empty Folder Bootstrapping**: Opening an empty folder automatically creates `01-chapter.md` to start writing immediately.
- **Clean Markdown Guarantee**: Never injects proprietary syntax or YAML headers into your prose. Project metadata and notes live separately in `noveler.json`.

### ✒️ Typesetting & Fiction Typography
- **Book-Style (Indented)**: Industry-standard `1.75em` first-line paragraph indentation with no gaps between paragraphs, automatically applying zero-indent to paragraphs following headings or scene breaks.
- **Web-Style (Block)**: Clean block paragraphs with spacing for web serials and newsletters.
- **Smart Typography**: Automatic transformation of straight quotes to curved smart quotes (`“ ”`, `‘ ’`), double hyphens to em-dashes (`—`), and triple periods to ellipses (`…`).
- **Scene Breaks (`✦   ✦   ✦`)**: Type `---` or use the toolbar button to insert centered decorative scene breaks rendered consistently across editor, preview, and exports.
- **Focus Modes**:
  - **Paragraph Focus (`Ctrl+Shift+P`)**: Keeps the active paragraph at 100% opacity while gently dimming surrounding text to 25% (hover reveals surrounding text at 65%).
  - **Typewriter Scrolling (`Ctrl+Shift+T`)**: Keeps the active line centered vertically on the screen.
  - **Distraction-Free Mode (`F11` / `Ctrl+Shift+F`)**: Hides sidebar, status bar, and toolbar for an immersive, centered canvas.

### 🏷️ Narrative Tags Engine
- **In-Text Hashtags**: Tag characters, locations, or clues directly in your prose (e.g., `#alice`, `#the-docks`, `#brass-key`).
- **Interactive Tag Cloud**: The sidebar **Tags** tab displays all tags in the active chapter with live frequency counts.
- **Tag Categories**: Organize tags into categories (`#characters`, `#locations`, `#items`, `#scenes`, or custom groups).
- **Click to Navigate**: Clicking any tag in the sidebar automatically jumps to and highlights the mention in the TipTap editor.

### 📝 4-Mode Canvas & Integrated Scratchpad
- **Pen Mode**: Dedicated full-width writing canvas.
- **Split Mode**: Side-by-side editor and live book-typeset preview.
- **Eye Mode**: Read-only book reader for proofreading and immersion.
- **Pen & Scratchpad Mode**: Split canvas featuring your chapter editor alongside a free-form scratchpad for brainstorming, character voices, and rough outlines.
  - Scratchpad contents persist per project in `noveler.json`.
  - Strictly isolated from your novel manuscript and exports.
  - **Flush to Graveyard**: One-click archive button flushes all current scratchpad notes into a `graveyard/` subfolder as an immutable timestamped Markdown file (`YYYY-MM-DD_HH-mm-ss.md`) and clears the scratchpad for fresh brainstorming.

### 🌿 Native Git & GitHub Cloud Sync
- **One-Click Push**: Push all chapters, notes, and settings directly to GitHub via the toolbar (`GitBranch` icon).
- **Automatic Repository Setup**: Initializes `git init -b main` if needed and creates a `.gitignore` to exclude internal `.noveler/` cache while preserving all manuscripts.
- **Timestamped Commits**: Commits all project changes with an automated timestamp (`Manuscript sync: YYYY-MM-DD HH:mm:ss`).
- **Safe & Non-Blocking**: Disables terminal interactive prompts (`GIT_TERMINAL_PROMPT=0`) to ensure background syncs never hang the UI. Prompts cleanly for remote URL on first sync.

### 🎨 Modular 16-Token Theme System
- Five handcrafted writer palettes defined with 16 unified CSS custom properties:
  - **Sepia** (Warm Book Paper - default)
  - **Light** (Crisp Modern Paper)
  - **Dark** (Midnight Slate)
  - **Forest** (Calming Organic Pine)
  - **Nord** (Cold Arctic Frost)
- **Zero-re-render switching**: Instant theme changes driven via `data-theme` attribute on the root DOM element with smooth transitions and custom text selection highlights.
- **Toolbar Theme Toggle**: Cycle through all themes with a single click or with `Ctrl+Shift+D`.

### 📊 Publishing Metrics & Goals
- **Live Status Bar**:
  - **Chapter Words**: Word count of the current chapter.
  - **Novel Words**: Real-time aggregated word count across every chapter in the project folder.
  - **Estimated Paperback Pages**: Calculated using publishing industry standard (`Novel Words / 250`).
  - **Reading Time**: Calculated at standard adult reading pace (`Novel Words / 250 wpm`).
- **Goals Modal (`Ctrl+G`)**: Set daily writing targets, track progress bars, and monitor writing streaks.

### 📦 Unified Manuscript Export (`Ctrl+E`)
- **Export Scope**: Export **Entire Novel** (compiles all chapters in sequence with formatted titles and scene breaks) or **Current Chapter Only**.
- **Supported Formats**:
  - **Microsoft Word (`.docx`) — Shunn Standard**: 1-inch margins, double-spaced lines (2.0), 0.5-inch paragraph indentation, centered title page, and font selection (*Times New Roman*, *Courier New*, *Georgia*, *Garamond*).
  - **Print / PDF (`Ctrl+P`)**: Clean `@media print` layout stripping all UI for printing or PDF generation.
  - **Clean Combined Markdown (`.md`)**: Merges all chapters into a clean, portable Markdown document.

### 🗂️ Novelist's Auxiliary Suite
- **Right-Click Thesaurus & Spellcheck**: Right-click any word or selected phrase to open a themed context menu. Features high-accuracy **Spelling Suggestions** for typos at the top of the menu and a nested **Thesaurus ▶** flyout for synonyms & antonyms. Replaces words in 1 click, automatically matching original casing (Title Case, UPPERCASE, lowercase) and leaving punctuation intact. Supports both the Datamuse API and offline dictionaries. Native OS context menu is accessible at any time via `Shift + Right Click`.
- **Codex**: Full worldbuilding reference bible for Characters, Locations, Lore, and Plot Notes.
- **Corkboard**: Visual index card board displaying chapter cards and synopses.
- **Prose Analysis**: Deep linguistic analysis including Flesch-Kincaid readability grade, passive voice detection, dialogue-to-narrative balance, and filler word detection.
- **Command Palette (`Ctrl+K`)**: Fast keyboard-driven command launcher.
- **Find & Replace (`Ctrl+F`)**: In-editor search with case matching and replace-all capabilities.

### 🛡️ Bulletproof Data Safety
- **Debounced Autosave**: Saves automatically 1.5 seconds after you pause typing.
- **Atomic File Writes**: Rust backend writes to temporary files before atomic replacement to prevent corruption during unexpected shutdowns.
- **Crash Recovery**: Unsaved drafts and untitled buffers are snapshotted in local cache and restored on relaunch.
- **Rolling Backups**: Automatically maintains timestamped backups in `<novel-folder>/.noveler/backups/` (keeps the last 20 snapshots per chapter).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + N` | New chapter (automatically sequenced) |
| `Ctrl + O` | Open novel folder |
| `Ctrl + S` | Save current chapter |
| `Ctrl + Shift + S` | Save As |
| `Ctrl + E` | Open Unified Export Modal |
| `Ctrl + P` | Print / Save as PDF |
| `Ctrl + \` | Toggle Sidebar (collapse / expand) |
| `Ctrl + Shift + D` | Cycle Theme (Sepia → Light → Dark → Forest → Nord) |
| `Ctrl + F` | Find and Replace |
| `Ctrl + K` | Open Command Palette |
| `Ctrl + G` | Open Goals & Statistics Modal |
| `Ctrl + Shift + P` | Toggle Paragraph Focus Mode (dims unfocused paragraphs) |
| `Ctrl + Shift + T` | Toggle Typewriter Scrolling |
| `Ctrl + Shift + F` / `F11` | Toggle Distraction-Free Focus Mode |
| `Escape` | Close modals / Exit focus mode |

---

## Tech Stack

- **Desktop Framework**: [Tauri 2](https://tauri.app/) (Rust backend for fast, secure native OS integration)
- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Editor Core**: [TipTap 3](https://tiptap.dev/) + [ProseMirror](https://prosemirror.net/)
- **Styling**: Pure CSS design tokens with 16 modular variables (`theme.css`)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Document Export**: `docx` for Shunn Standard Word documents, DOMPurify + marked for sanitized Markdown/HTML
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) with JSDOM

---

## Getting Started

### Prerequisites

1. **Node.js**: Version 22 or higher
2. **Rust**: Version 1.90 or higher (via [rustup](https://rustup.rs/))
3. **Platform Prerequisites**: Follow the official [Tauri Prerequisites](https://tauri.app/start/prerequisites/) for your operating system (C++ Build Tools on Windows, `webkit2gtk` on Linux, Xcode command line tools on macOS).

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/your-username/Noveler.git
cd Noveler

# Install Node dependencies
npm install

# Run the desktop application in development mode (with hot reload)
npm run tauri dev

# Run frontend-only in the browser (limited: no direct native filesystem access)
npm run dev
```

### Quality Assurance & Building

```bash
# Run full quality check (typecheck + eslint + unit tests)
npm run check

# Run Vitest unit tests
npm run test

# Run Rust native backend unit tests
npm run test:rust

# Build production desktop installer/bundle
npm run tauri build
```
Production bundles will be generated under `src-tauri/target/release/bundle/`.

---

## Project Structure

```
Noveler/
├── GUIDE.md                  # Comprehensive Writer's Handbook and User Manual
├── THEMES_SPECIFICATION.md   # 16-token design system specifications
├── package.json              # Scripts and frontend dependencies
├── src/
│   ├── App.tsx               # Root component, layout switcher, theme sync
│   ├── components/
│   │   ├── CodexModal/       # Worldbuilding lore manager
│   │   ├── CommandPalette/   # Quick action search (Ctrl+K)
│   │   ├── CompileModal/     # Unified Export Modal (Ctrl+E)
│   │   ├── Corkboard/        # Index card overview
│   │   ├── Editor/           # TipTap rich text canvas
│   │   ├── FindReplace/      # In-text search and replace
│   │   ├── GoalsModal/       # Writing target & statistics dashboard
│   │   ├── Preview/          # Live book-typeset preview
│   │   ├── ProseAnalysis/    # Readability and linguistic metrics
│   │   ├── Scratchpad/       # Side-by-side scratchpad editor
│   │   ├── Sidebar/          # Chapter navigator & Tags tab
│   │   ├── StatusBar/        # Word counters, pages, reading time
│   │   ├── ThemeToggle/      # 5-theme fast cycler
│   │   └── Toolbar/          # Formatting tools & view mode selectors
│   ├── export/               # Shunn DOCX compiler & print stylesheet
│   ├── hooks/                # Keyboard shortcuts, close guard, recovery
│   ├── services/             # File system IPC, project loader, backups, Git sync
│   ├── stores/               # Zustand editor & project state store
│   ├── styles/
│   │   ├── global.css        # Layout, typography, transitions
│   │   └── theme.css         # 16 design tokens for 5 themes
│   └── utils/                # Chapter numbering, hashtag parser, prose analysis
└── src-tauri/
    ├── Cargo.toml            # Rust dependencies (tauri, serde, dirs)
    ├── tauri.conf.json       # Window setup, permissions, bundle config
    └── src/
        ├── commands.rs       # Native file operations, atomic write, backups, Git sync
        └── lib.rs            # Tauri application entry point
```

---

## File System & Storage Architecture

When you write a novel in Noveler, your project directory is structured cleanly:

```
MyNovel/
├── 01-the-beginning.md       # 100% clean Markdown (Chapter 1)
├── 02-the-investigation.md   # 100% clean Markdown (Chapter 2)
├── 03-the-confrontation.md   # 100% clean Markdown (Chapter 3)
├── noveler.json              # Project settings, scratchpad, tag categories, chapter titles
├── graveyard/                # Flushed scratchpad snapshots (YYYY-MM-DD_HH-mm-ss.md)
└── .noveler/
    └── backups/              # Rolling chapter backups (up to 20 snapshots per chapter)
```

No proprietary metadata or frontmatter will ever be added to your `.md` files. You can safely open, edit, and sync your chapter files using any text editor, Git, or cloud sync service (Dropbox, Google Drive, OneDrive).

---

## Detailed Writer's Guide

For an in-depth walkthrough of writing workflows, narrative tagging techniques, typesetting standards, and manuscript submission formats, consult the [Noveler Writer's Handbook](GUIDE.md).

---

## License

Private project. All rights reserved.
