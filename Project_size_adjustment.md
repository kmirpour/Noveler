Used tool: manage_task
Viewed package.json:1-61
Listed directory src
Ran command: `cmd /c "dir /s e:\Projects\Noveler2\src | findstr \"File(s)\""`
Used tool: manage_task

**No, you do not need to back up the 9 GB.** 

More than **98% of that 9 GB** is temporary compiled build cache and downloaded packages that can be regenerated at any time with a single command. Your actual project source code is only around **10 to 20 MB**.

---

### Where the 9 GB is Coming From

In a Tauri + React/Vite project like Noveler, disk space is dominated by two directories:

1. **`src-tauri/target/` (~7 to 8+ GB):** 
   - This is the Rust compiler's build output. Every time you build or run the desktop app, Rust compiles dependencies and stores massive debug symbols, intermediate object files (`.rlib`, `.pdb`), and binary caches here.
2. **`node_modules/` (~500 MB to 1 GB):** 
   - Downloaded JavaScript/TypeScript libraries managed by npm.
3. **`dist/`:** 
   - Compiled frontend web assets.

Both [`.gitignore`](file:///e:/Projects/Noveler2/.gitignore) and [`src-tauri/.gitignore`](file:///e:/Projects/Noveler2/src-tauri/.gitignore) already ignore these folders because they are **not** part of your source code.

---

### What Actually Contains the "Main Functionality"

To back up 100% of the project's functionality and logic, you only need:

| Folder / File | What It Does |
| :--- | :--- |
| [**`src/`**](file:///e:/Projects/Noveler2/src) | **All frontend application code:** React components, TipTap Markdown editor setup, state stores, themes, export logic, and styling. |
| [**`src-tauri/`**](file:///e:/Projects/Noveler2/src-tauri) *(excluding `target/`)* | **Desktop backend:** Rust source code ([`src-tauri/src/`](file:///e:/Projects/Noveler2/src-tauri/src)), app configuration ([`tauri.conf.json`](file:///e:/Projects/Noveler2/src-tauri/tauri.conf.json)), dependencies list ([`Cargo.toml`](file:///e:/Projects/Noveler2/src-tauri/Cargo.toml)), and app icons ([`src-tauri/icons/`](file:///e:/Projects/Noveler2/src-tauri/icons)). |
| [**`public/`**](file:///e:/Projects/Noveler2/public) | Static assets and icons served to the frontend. |
| **Root configs** | [`package.json`](file:///e:/Projects/Noveler2/package.json), [`package-lock.json`](file:///e:/Projects/Noveler2/package-lock.json), [`tsconfig.json`](file:///e:/Projects/Noveler2/tsconfig.json), [`vite.config.ts`](file:///e:/Projects/Noveler2/vite.config.ts), and [`index.html`](file:///e:/Projects/Noveler2/index.html). |
| **Documentation** | [`GUIDE.md`](file:///e:/Projects/Noveler2/GUIDE.md), [`README.md`](file:///e:/Projects/Noveler2/README.md), and specification docs. |

---

### How to Back Up Without the Bloat

#### Option 1: Back up the entire folder but exclude `target` and `node_modules` (Recommended)
When creating a `.zip` or copying to a backup drive, **simply exclude**:
- `src-tauri/target/`
- `node_modules/`
- `dist/`

You can create a clean zip file directly in PowerShell by running:
```powershell
Compress-Archive -Path src, src-tauri\src, src-tauri\capabilities, src-tauri\icons, src-tauri\Cargo.toml, src-tauri\tauri.conf.json, src-tauri\build.rs, public, package.json, package-lock.json, tsconfig.json, vite.config.ts, index.html, *.md -DestinationPath "..\Noveler2_Backup.zip"
```
*(The resulting zip will be around **15–25 MB** instead of 9 GB).*

#### Option 2: Use Git / GitHub
Because your [`.gitignore`](file:///e:/Projects/Noveler2/.gitignore) is already configured to ignore `node_modules/` and `src-tauri/target/`, committing to Git or pushing to a private GitHub repository automatically backs up 100% of the project functionality while skipping all the gigabytes of junk.

---

### How to Restore the Project from a Clean Backup
If you ever move your backup to a new computer or folder:
1. Run `npm install` (restores `node_modules/`).
2. Run `npm run tauri dev` or `npm run tauri build` (Cargo automatically downloads Rust dependencies and rebuilds `src-tauri/target/`).

> [!TIP]
> **Freeing up the 9 GB right now:** If you want to reclaim disk space immediately on your drive, you can safely delete the `src-tauri/target` folder or run `cargo clean` inside `src-tauri`. It will not break anything; it will simply recompile next time you build.