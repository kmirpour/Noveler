# Noveler: The Writer's Handbook & Complete Guide

Welcome to **Noveler**, a distraction-free desktop writing studio designed specifically for fiction novelists, dramatists, and long-form storytellers. 

This handbook explains how Noveler works, the principles behind its architecture, and how to use every capability to write, organize, and export submission-ready manuscripts.

---

## Table of Contents

1. [The Novel-as-a-Folder Architecture](#1-the-novel-as-a-folder-architecture)
2. [Setting Up Your Novel Project](#2-setting-up-your-novel-project)
3. [Chapter Management & Numbering](#3-chapter-management--numbering)
4. [Typesetting & Fiction Typography](#4-typesetting--fiction-typography)
5. [Distraction-Free Focus & Writing Modes](#5-distraction-free-focus--writing-modes)
6. [View Modes & The Scratchpad](#6-view-modes--the-scratchpad)
7. [The Narrative Tags Engine](#7-the-narrative-tags-engine)
8. [The Novelist's Auxiliary Suite](#8-the-novelists-auxiliary-suite)
   - [The Codex (Worldbuilding)](#the-codex-worldbuilding)
   - [The Corkboard (Outlining & Synopses)](#the-corkboard-outlining--synopses)
   - [Prose Analysis](#prose-analysis)
   - [Right-Click Thesaurus & Spellcheck Suggestions](#right-click-thesaurus--spellcheck-suggestions)
   - [Goals & Word Targets](#goals--word-targets)
   - [Find & Replace & Command Palette](#find--replace--command-palette)
9. [Publishing Metrics & Book Calculations](#9-publishing-metrics--book-calculations)
10. [Visual Themes & Eye Comfort](#10-visual-themes--eye-comfort)
11. [Compiling & Exporting Manuscripts](#11-compiling--exporting-manuscripts)
12. [Data Safety, Backups & Disaster Recovery](#12-data-safety-backups--disaster-recovery)
13. [Keyboard Shortcuts Reference](#13-keyboard-shortcuts-reference)

---

## 1. The Novel-as-a-Folder Architecture

Most text editors treat every file as an isolated document, while bloated word processors trap your manuscript inside complex proprietary files. Noveler adopts a transparent, author-friendly model: **an entire folder on your computer represents your novel**.

```
MyNovel/
├── 01-the-arrival.md         # Clean Markdown Chapter 1
├── 02-the-letter.md          # Clean Markdown Chapter 2
├── 03-the-confrontation.md   # Clean Markdown Chapter 3
├── noveler.json              # Companion metadata file (settings, scratchpad, lore)
└── .noveler/
    └── backups/              # Rolling chapter revisions
```

### 100% Clean Markdown Guarantee
All chapter files (`.md`) contain **pure, standard Markdown**:
- **No YAML frontmatter** is ever written into your prose.
- **No proprietary tags or custom code syntax** are injected into your files.
- Every `.md` file is readable and editable in any standard Markdown editor (Obsidian, VS Code, iA Writer, Ulysses, or Notepad), syncable via Git, and portable forever.
- Any project-specific metadata (scratchpad notes, synopsis cards, tag categories) is maintained cleanly in the companion `noveler.json` file.

### Flat Folder Structure
All chapters belong directly in the root of your novel's project directory. **Do not create subfolders for individual chapters**. Noveler indexes all root-level `.md` files and handles sequential sorting automatically.

---

## 2. Setting Up Your Novel Project

### Opening or Creating a Novel Project
1. Click the **Open Folder** button in the top toolbar or sidebar header (or press `Ctrl + O`).
2. Select any folder on your computer (e.g., `Documents/MyNovels/TheQuietDawn`).
3. **Empty Folder Initialization**: If the selected folder is empty, Noveler automatically generates your first chapter file—`01-chapter.md`—with starter text so you can begin writing immediately.
4. **Existing Folder**: If the folder already contains Markdown files, Noveler indexes them, sorts them by their sequential prefixes, and displays them in the sidebar.

> **💡 Best Practice**: Create a dedicated directory for each book or project. Noveler will never modify non-Markdown files located in the folder.

---

## 3. Chapter Management & Numbering

### Adding New Chapters
- Click the **+ Chapter** button in the sidebar or press `Ctrl + N`.
- Noveler automatically calculates the next sequential number (e.g., `02-chapter.md`, `03-chapter.md`) and opens the new file in the editor ready for writing.

### Sequential Naming Conventions
Noveler uses numeric prefixes to maintain natural narrative order:
- `01-chapter.md`, `02-chapter.md`, `03-chapter.md`
- You can replace `chapter` with descriptive chapter titles:
  - `01-the-arrival.md`
  - `02-shadows-over-the-harbor.md`
  - `03-an-unexpected-guest.md`
- The sidebar displays chapters cleaned of their numbers for clear readability (e.g., *The Arrival*, *Shadows Over The Harbor*) while preserving their filenames on disk.

### Renaming and Deleting
- **Renaming**: Hover over any chapter in the sidebar and click the **Pencil** icon to rename the chapter title. Noveler updates the filename and updates project metadata.
- **Deleting**: Click the **Trash** icon to delete a chapter file. Noveler will prompt you to confirm before deleting from disk.

---

## 4. Typesetting & Fiction Typography

Noveler provides visual formatting tools tailored specifically for fiction publishing standards while saving clean Markdown behind the scenes.

### Fiction Paragraph Styles
Fiction publishing uses strict paragraph conventions that differ from standard web formatting. You can switch styles using the paragraph indent toggle in the toolbar:

1. **Book Style (Indented)** *(Industry Standard)*:
   - Applies a `1.75em` first-line paragraph indent.
   - Eliminates vertical spacing between consecutive paragraphs.
   - Automatically applies **zero indent** to the first paragraph of a chapter and any paragraph immediately following a heading or scene break.
2. **Web Style (Block)**:
   - Uses zero indentation with vertical white space between paragraphs.
   - Ideal for serialized web fiction, blog posts, or newsletter releases.

### Scene Breaks (`✦   ✦   ✦`)
- To indicate a scene transition, time jump, or POV shift within a chapter, type `---` on a new line or click the **Minus** icon in the formatting toolbar.
- Both the writing canvas and the live preview render scene breaks as centered decorative ornaments:
  ```
  ✦   ✦   ✦
  ```
- Compiling to `.docx` or PDF formats preserves this standard scene break styling.

### Smart Quotes & Punctuation
As you type, Noveler automatically enhances standard keyboard characters:
- Straight quotes (`"` and `'`) convert to directional curly quotes (`“ ”` and `‘ ’`).
- Double hyphens (`--`) convert to an em-dash (`—`).
- Triple periods (`...`) convert to an ellipsis character (`…`).

### Structural Headings
- **Heading 1 (`# Title`)**: Best used for novel titles or major Book/Act divisions.
- **Heading 2 (`## Chapter Title`)**: Standard chapter headings.
- **Heading 3 (`### Scene / POV`)**: Subheadings for scene titles, locations, or POV indicators.

---

## 5. Distraction-Free Focus & Writing Modes

Noveler includes three distinct focus features designed to keep your mind locked in the story:

### 1. Paragraph Focus Mode (`Ctrl + Shift + P`)
- Click the **Paragraph Focus** (viewfinder) icon in the toolbar or press `Ctrl + Shift + P`.
- The active paragraph you are editing remains fully opaque and sharp (100%), while preceding and succeeding paragraphs gently dim (to 25% opacity).
- Hovering your mouse over any dimmed paragraph provides a preview at 65% opacity.
- Allows you to concentrate on the immediate rhythm of the current line without losing your place.

### 2. Typewriter Scrolling Mode (`Ctrl + Shift + T`)
- Toggle Typewriter Scrolling via the toolbar or `Ctrl + Shift + T`.
- Keeps the current line of text vertically centered on the screen as you write, preventing your eyes from sinking down to the bottom of the display.

### 3. Distraction-Free Fullscreen Mode (`F11` or `Ctrl + Shift + F`)
- Hides the sidebar, top toolbar, and bottom status bar completely.
- Centers your text canvas with generous margins against your chosen theme background.
- Press `Escape`, `F11`, or `Ctrl + Shift + F` to return to the standard window layout.

### 4. Sidebar Toggle (`Ctrl + \`)
- Press `Ctrl + \` at any time to instantly collapse or expand the chapter navigation panel.

---

## 6. View Modes & The Scratchpad

Noveler offers four workspace view modes accessible via the view pills in the toolbar:

| View Mode | Icon | Description |
|---|---|---|
| **Pen Mode** | ✏️ Pen | Pure distraction-free writing canvas for drafting. |
| **Split Mode** | ◫ Split | Side-by-side editing canvas and live book-typeset preview. |
| **Eye Mode** | 👁️ Eye | Read-only book reader for proofreading and immersion. |
| **Pen & Scratchpad** | 📝 Note | Split canvas with active chapter editor on the left and persistent Scratchpad on the right. |

### Using the Scratchpad & Flushing to Graveyard
The **Scratchpad** is an integrated free-form notepad designed for spontaneous notes that shouldn't interrupt your drafting flow:
- **What to put here**: Snippets of dialogue, alternate phrasing, reminders for later chapters, sensory details, or beat outlines.
- **Project-Scoped & Persistent**: Notes written in the scratchpad are saved automatically in `noveler.json` and remain accessible whenever you open this novel.
- **Manuscript Isolation**: Scratchpad text is **never** added to your `.md` chapter files and is completely excluded from manuscript compilation and exports.
- **Flush to Graveyard (`Archive` icon)**: 
  - When your scratchpad is full or you want to archive scrap scenes and research notes, click the **Flush to Graveyard** button in the scratchpad header.
  - Noveler automatically creates a `graveyard/` subfolder in your novel project and writes your notes to a timestamped Markdown file (e.g. `graveyard/2026-10-04_22-45-00.md`).
  - Clears the active scratchpad so you can start fresh with a clean slate while preserving all past notes on disk forever.
- **Word Counter & Clear**: Includes a live word counter and an **Eraser** button for quick clearing.

---

## 7. The Narrative Tags Engine

Tracking characters, clues, and locations across an 80,000-word manuscript can be daunting. Noveler includes a built-in narrative tagging engine that extracts hashtags directly from your prose in real time.

### How to Tag in Prose
Simply write a hashtag anywhere in your text:

```markdown
#alice was waiting near #the-docks when #inspector-morse arrived.
She hid the #brass-key deep in her coat pocket.
```

- Hashtags are standard text and remain fully readable in any Markdown reader.
- Markdown headers (`# Chapter`, `## Scene`) are intelligently ignored.

### The Sidebar Tags Tab
Click the **Tags** tab at the top of the sidebar to view:
1. **Interactive Tag Cloud**: All hashtags present in the active chapter are displayed with frequency badges (e.g., `#alice (4)`, `#the-docks (2)`).
2. **Jump-to-Tag Navigation**: Click any tag pill in the list to immediately scroll the editor to that exact mention and highlight it.
3. **Category Grouping**:
   - Filter your tags by category pills (`All`, `#characters`, `#locations`, `#items`, `#scenes`, or custom).
   - Click the **+ Category** button in the Tags tab to define custom categories.

### When to Use Tags vs The Codex
- **Narrative Tags (`#tag`)**: Use for quick in-text tracking, scene-by-scene presence checks, and jump navigation.
- **The Codex**: Use for detailed worldbuilding profiles, character backstories, relationships, and deep lore reference.

---

## 8. The Novelist's Auxiliary Suite

### The Codex (Worldbuilding)
Open the Codex from the toolbar to access a structured story bible:
- **Categories**: Characters, Locations, Items, and Lore.
- **Entity Cards**: Track descriptions, roles, character aliases, relationships, and private author notes.
- Saved automatically in your project configuration.

### The Corkboard (Outlining & Synopses)
Open the Corkboard to view your manuscript as physical index cards:
- Each chapter appears as an index card showing its title, word count, and synopsis.
- Draft scene summaries and outline upcoming chapters before writing prose.

### Prose Analysis
Open the Prose Analysis panel from the toolbar to analyze the linguistic quality of your chapter:
- **Readability Scores**: Flesch-Kincaid Grade Level and Reading Ease score.
- **Passive Voice Detector**: Highlights passive constructions to help strengthen action beats.
- **Dialogue Ratio**: Visualizes the percentage of spoken dialogue versus descriptive narrative prose.
- **Filler Word & Adverb Detector**: Identifies overused adverbs (`-ly`) and filter words (*felt, heard, noticed, seemed*) that weaken point-of-view immediacy.

### Right-Click Thesaurus & Spellcheck Suggestions
Right-click on any word or highlighted text in the editor to open a themed context menu:
- **Spelling Corrections**: If a word is misspelled, high-confidence spelling replacement suggestions appear at the very top of the menu in bold. Clicking any suggestion immediately replaces the typo with the correct word and matching casing.
- **Thesaurus Flyout**: Hovering over **Thesaurus ▶** displays high-relevance **Synonyms** and **Antonyms**.
- **1-Click Replacement**: Clicking any suggestion immediately replaces the word in your manuscript.
- **Smart Casing & Punctuation**: Automatically preserves original casing (e.g., `"Brilliant"` ➔ `"Radiant"`, `"Misspeled"` ➔ `"Misspelled"`) and preserves punctuation (quotes, commas, periods) around the word.
- **Hybrid Online/Offline Architecture**: Powered by the Datamuse API backed by in-memory session caching and comprehensive offline fallback dictionaries for both typos and synonyms when writing without an internet connection.
- **Standard Clipboard Actions**: Includes Cut (`Ctrl + X`), Copy (`Ctrl + C`), and Paste (`Ctrl + V`).
- **Native Context Menu Access**: Hold `Shift + Right Click` at any time to bypass the custom menu and open the native operating system/browser context menu (for system-level actions like adding custom words to the OS dictionary).

### Goals & Word Targets (`Ctrl + G`)
Open the Goals modal to configure your writing milestones:
- **Daily Target**: Set a session goal (e.g., 1,000 words/day). The status bar updates your daily progress bar in real time.
- **Manuscript Target**: Set total project targets (e.g., 85,000 words).
- **Streak Tracker**: Tracks consecutive days of writing activity.

### Find & Replace & Command Palette
- **Find & Replace (`Ctrl + F`)**: Clean in-editor search bar supporting case sensitivity, whole word matching, and Replace / Replace All.
- **Command Palette (`Ctrl + K`)**: Rapid keyboard command launcher for toggling modes, opening tools, and switching views.

---

## 9. Publishing Metrics & Book Calculations

Noveler provides real-time statistics tailored to the traditional publishing industry, visible in the bottom status bar and Goals modal:

1. **Chapter Words**: Word count of the active chapter file.
2. **Novel Words**: Real-time aggregated word count across every chapter in the project folder.
3. **Estimated Paperback Pages**: Calculated using the publishing industry standard of **250 words per page**:
   $$\text{Estimated Pages} = \frac{\text{Novel Words}}{250}$$
   *(An 80,000-word draft represents approximately 320 printed paperback pages).*
4. **Reading Time**: Calculated at an average adult reading pace of **250 words per minute**:
   $$\text{Reading Time (minutes)} = \frac{\text{Novel Words}}{250}$$

---

## 10. Visual Themes & Eye Comfort

Noveler features a modular 16-token theme system built for long writing sessions:

| Theme | Inspiration | Best For |
|---|---|---|
| **Sepia** *(Default)* | Warm cream book paper | Long daytime writing sessions with reduced eye fatigue. |
| **Light** | Crisp modern editorial paper | High-contrast daytime drafting and proofreading. |
| **Dark** | Deep slate and midnight navy | Night writing and low-light environments. |
| **Forest** | Calming organic moss and pine | Relaxing, nature-inspired creative flow. |
| **Nord** | Arctic frost and cold slate | Cool, modern, muted contrast. |

### How to Switch Themes
- Click the **Theme Toggle** button in the toolbar (displays active theme icon and name).
- Press `Ctrl + Shift + D` to cycle to the next theme.
- Theme switching is instantaneous with zero screen flicker and custom text selection colors tailored to each palette.

---

## 11. Compiling & Exporting Manuscripts

When your manuscript or chapter is ready for beta readers, an editor, or literary agent submission, open the **Export Modal** by pressing `Ctrl + E` or clicking **Export** in the toolbar.

### Export Scope
- **Compile Entire Novel**: Automatically iterates through every chapter in your folder in natural numerical order, formats titles, inserts decorative scene breaks, and bundles the entire manuscript into a single file.
- **Current Chapter Only**: Exports only the chapter currently open in the editor.

### Submission-Ready Formats

#### 1. Microsoft Word (`.docx`) — William Shunn Standard
The gold standard format required by literary agents, commercial publishing houses, and fiction magazines:
- **Margins**: Exactly 1.0 inch on all four sides.
- **Line Spacing**: Strict double spacing (`2.0`).
- **Indentation**: Exactly 0.5-inch first-line paragraph indentation.
- **Title Page**: Centered title block with novel title, author name, and estimated word count.
- **Typeface Selection**: Choose from accepted publishing typefaces (*Times New Roman*, *Courier New*, *Georgia*, or *Garamond*).

#### 2. Print / PDF (`Ctrl + P`)
- Applies clean `@media print` book typography.
- Automatically removes all UI buttons, sidebars, and toolbars.
- Generates clean chapter page breaks ready for physical printing or saving as a PDF via the system print dialog.

#### 3. Clean Combined Markdown (`.md`)
- Merges all chapters into a single sequential Markdown document.
- Ideal for personal archival, GitHub backups, or custom Pandoc publishing pipelines.

---

## 12. Data Safety, Backups & Disaster Recovery

Writing a novel represents hundreds of hours of creative labor. Noveler includes an multi-layered data protection architecture:

### 1. Debounced Autosave
- Changes are automatically saved to disk 1.5 seconds after you pause typing.
- The status bar displays a live status indicator (green dot for *Saved*, orange for *Unsaved changes*).

### 2. Atomic File Writes
- All file writes are executed through the native Rust backend.
- Files are written to a temporary sibling file and replaced atomically on disk, preventing file truncation or corruption if your computer loses power during a save.

### 3. Crash Snapshots & Recovery
- Active drafts and unsaved buffers are continuously snapshotted in local application state.
- If the application closes unexpectedly, Noveler detects the snapshot on relaunch and prompts you to restore your unsaved text.

### 4. Rolling Versioned Backups
- Noveler maintains automatic rolling chapter backups under:
  ```
  <NovelFolder>/.noveler/backups/<chapter-name>/
  ```
- Keeps the last 20 revisions of each chapter (at most one snapshot per 10-minute interval).
- If you accidentally delete text or want to recover an earlier revision, previous drafts are preserved locally on disk.

### 5. Git & GitHub Cloud Synchronization
- Noveler includes built-in Git integration to back up and version your entire novel to GitHub:
  - Click the **Git / GitHub** (`GitBranch`) icon in the toolbar or run **Push Manuscript to GitHub** via the Command Palette (`Ctrl + K`).
  - **Automated Repository Initialization**: If your novel folder is not yet a git repository, Noveler initializes a git repository on branch `main` and creates a `.gitignore` ignoring internal backups.
  - **Remote Origin Setup**: If no remote URL is configured, Noveler prompts once for your repository URL (e.g., `https://github.com/username/my-novel.git`).
  - **Instant Snapshot**: Noveler automatically stages all chapter files, writes an automated timestamped commit (e.g. `Manuscript update: 2026-10-04_224500`), and pushes to your GitHub remote.

---

## 13. Keyboard Shortcuts Reference

Keep your hands on the keyboard with these shortcuts:

### Document & File Operations
| Shortcut | Action |
|---|---|
| `Ctrl + N` | Create next sequential chapter (`02-chapter.md`) |
| `Ctrl + O` | Open novel project folder |
| `Ctrl + S` | Save current chapter |
| `Ctrl + Shift + S` | Save current chapter as a new file |
| `Ctrl + E` | Open Unified Export Modal |
| `Ctrl + P` | Print / Export as PDF |

### Workspace & View Controls
| Shortcut | Action |
|---|---|
| `Ctrl + \` | Toggle Sidebar (collapse / expand) |
| `Ctrl + Shift + D` | Cycle Theme (Sepia → Light → Dark → Forest → Nord) |
| `Ctrl + Shift + T` | Toggle Typewriter Scrolling Mode |
| `Ctrl + Shift + P` | Toggle Paragraph Focus Mode |
| `Ctrl + Shift + F` / `F11` | Toggle Fullscreen Distraction-Free Focus Mode |
| `Escape` | Dismiss open dialogs or exit focus mode |

### Writing & Auxiliary Tools
| Shortcut | Action |
|---|---|
| `Ctrl + F` | Find and Replace in chapter |
| `Ctrl + K` | Open Command Palette |
| `Ctrl + G` | Open Goals & Word Statistics Modal |

---

*Happy writing! May your characters surprise you and your words flow freely.*
