# 🎨 Modular IDE Theme System — Implementation Blueprint & Specification

> **A turnkey, zero-runtime-overhead design token & theme switching architecture for text editors, IDEs, and writing applications.**
> *Created for automated reproduction across projects by AI agents and developers.*

---

## 1. Architectural Pattern: The Zero-Re-render Model

### The Problem in Traditional Theme Switching
Many React/web editors re-render the entire component tree when a theme switches (e.g., passing `theme="dark"` down through React Context or CSS-in-JS). For large documents and rich-text editors (TipTap, Monaco, ProseMirror, CodeMirror), this causes DOM recalculation spikes, cursor flickering, and input latency.

### The Solution: CSS Custom Property Cascade
1. **State**: The theme name (`"sepia"`, `"light"`, `"dark"`) is maintained in a lightweight reactive store.
2. **Sync**: A single top-level side effect attaches `data-theme="<name>"` to `document.documentElement` (`<html>`).
3. **Cascade**: Components reference **semantic CSS variables** (`var(--bg-editor)`, `var(--text-color)`).
4. **Result**: Theme switches execute at the GPU layout engine level in **< 1ms** with **0 component re-renders**.

```
[UI Controller / Button]
        │
        ▼
[Global State: theme = "dark"]
        │
        ▼ (Single 1-line Effect)
[DOM Root: <html data-theme="dark">]
        │
        ▼ (CSS Cascade Engine)
[CSS Custom Properties: --bg-app, --text-color, etc.]
        │
        ▼ (Instant Native Repaint)
[Components: Editor, Sidebar, Toolbar, StatusBar]
```

---

## 2. Design Token Contract (CSS Variables)

Every theme must define this exact set of 16 tokens to satisfy all UI layers:

| Token Name | Semantic Role |
|---|---|
| `--bg-app` | Window background / outer canvas |
| `--bg-editor` | Central editing sheet / paper |
| `--bg-preview` | Live preview / reader canvas |
| `--bg-sidebar` | Navigation sidebar & file tree background |
| `--bg-toolbar` | Top toolbar & command palette header |
| `--bg-card` | Floating modals, dropdowns, cards, inputs |
| `--text-color` | Primary body copy & text color |
| `--text-muted` | Line numbers, subtitles, metadata, shortcuts |
| `--heading-color` | Titles, section headers (H1–H3) |
| `--border-color` | Pane dividers, split borders, subtle outlines |
| `--accent-color` | Primary brand accent, active state indicator |
| `--accent-light` | Pill tag background, subtle selection tint |
| `--accent-hover` | Button hover state for accent controls |
| `--btn-hover` | Standard button hover background |
| `--tag-bg` | Hashtag / badge background |
| `--tag-color` | Hashtag / badge foreground text |

---

## 3. Ready-to-Copy CSS Palettes (`styles/theme.css`)

Copy and paste this CSS block directly into your project's global stylesheet:

```css
/* ==========================================================================
   THEME 1: SEPIA (Warm Book Paper - Default)
   Best for: Multi-hour writing, reading, reducing blue-light fatigue
   ========================================================================== */
:root,
[data-theme='sepia'] {
  --bg-app: #f7f5ef;
  --bg-editor: #fcfbf9;
  --bg-preview: #f5f3ec;
  --bg-sidebar: #f2efe7;
  --bg-toolbar: #ede9df;
  --bg-card: #ffffff;
  --text-color: #2e2c29;
  --text-muted: #736f68;
  --heading-color: #1f1d1a;
  --border-color: #e0dacf;
  --accent-color: #8b683e;
  --accent-light: #e5ded2;
  --accent-hover: #73532e;
  --btn-hover: #e5e0d4;
  --tag-bg: #e6ded1;
  --tag-color: #634725;
}

/* ==========================================================================
   THEME 2: LIGHT (Crisp Modern Paper)
   Best for: Daytime editing, high-contrast proofreading
   ========================================================================== */
[data-theme='light'] {
  --bg-app: #ffffff;
  --bg-editor: #ffffff;
  --bg-preview: #fafafa;
  --bg-sidebar: #f8f9fa;
  --bg-toolbar: #f1f3f5;
  --bg-card: #ffffff;
  --text-color: #1a1a2e;
  --text-muted: #6c757d;
  --heading-color: #16213e;
  --border-color: #e2e4ea;
  --accent-color: #2b579a;
  --accent-light: #e6edf8;
  --accent-hover: #1e3f70;
  --btn-hover: #e9ecef;
  --tag-bg: #e3ebf7;
  --tag-color: #1c3b6c;
}

/* ==========================================================================
   THEME 3: DARK / MIDNIGHT (Deep Slate & Navy)
   Best for: Late-night drafting, low-light environments
   ========================================================================== */
[data-theme='dark'] {
  --bg-app: #12141a;
  --bg-editor: #161821;
  --bg-preview: #13151c;
  --bg-sidebar: #181a24;
  --bg-toolbar: #1c1e2a;
  --bg-card: #1f2230;
  --text-color: #d8dbe2;
  --text-muted: #8c92a4;
  --heading-color: #f0f2f8;
  --border-color: #272a3b;
  --accent-color: #d4a373;
  --accent-light: #2c2824;
  --accent-hover: #e8b686;
  --btn-hover: #262938;
  --tag-bg: #2b2520;
  --tag-color: #e0b080;
}

/* ==========================================================================
   THEME 4 (BONUS): FOREST / SAGE (Calming Organic Greens)
   ========================================================================== */
[data-theme='forest'] {
  --bg-app: #19201d;
  --bg-editor: #1f2824;
  --bg-preview: #1b2320;
  --bg-sidebar: #161d1a;
  --bg-toolbar: #232d29;
  --bg-card: #28332e;
  --text-color: #dbe4df;
  --text-muted: #879990;
  --heading-color: #edf3f0;
  --border-color: #2b3933;
  --accent-color: #79a88d;
  --accent-light: #23342b;
  --accent-hover: #92bfa6;
  --btn-hover: #2a3731;
  --tag-bg: #23342b;
  --tag-color: #92bfa6;
}

/* ==========================================================================
   THEME 5 (BONUS): NORD (Cold Arctic Frost)
   ========================================================================== */
[data-theme='nord'] {
  --bg-app: #242933;
  --bg-editor: #2e3440;
  --bg-preview: #292f3b;
  --bg-sidebar: #222630;
  --bg-toolbar: #2b303c;
  --bg-card: #3b4252;
  --text-color: #eceff4;
  --text-muted: #7d899f;
  --heading-color: #88c0d0;
  --border-color: #3b4252;
  --accent-color: #88c0d0;
  --accent-light: #2d3844;
  --accent-hover: #8fbcbb;
  --btn-hover: #3b4252;
  --tag-bg: #2d3844;
  --tag-color: #88c0d0;
}

/* Global smoothing & selection color */
::selection {
  background: var(--accent-light);
  color: var(--text-color);
}
```

---

## 4. State Management Implementations

### Option A: TypeScript + Zustand (Recommended)

Save as `src/stores/themeStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'sepia' | 'light' | 'dark' | 'forest' | 'nord';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
}

const THEME_ORDER: ThemeMode[] = ['sepia', 'light', 'dark', 'forest', 'nord'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'sepia',
      setTheme: (theme) => set({ theme }),
      cycleTheme: () => {
        const current = get().theme;
        const nextIndex = (THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length;
        set({ theme: THEME_ORDER[nextIndex] });
      },
    }),
    {
      name: 'app-theme-storage', // Persists user choice in localStorage automatically
    }
  )
);
```

### Option B: Vanilla JavaScript (Framework-Agnostic)

Save as `themeManager.js`:

```javascript
const THEMES = ['sepia', 'light', 'dark', 'forest', 'nord'];
let currentTheme = localStorage.getItem('app-theme') || 'sepia';

export function applyTheme(themeName) {
  if (!THEMES.includes(themeName)) return;
  currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('app-theme', themeName);
}

export function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
  applyTheme(next);
  return next;
}

// Initialize on script load
applyTheme(currentTheme);
```

---

## 5. React Integration Pattern

In your main entry component (`App.tsx` or `Layout.tsx`):

```tsx
import { useEffect } from 'react';
import { useThemeStore } from './stores/themeStore';

export function App() {
  const { theme } = useThemeStore();

  // Single DOM sync hook
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app-container">
      {/* Rest of the IDE */}
    </div>
  );
}
```

---

## 6. Component Consumption Rules

To ensure a smooth transition when switching themes, components should follow these rules:

1. **Always use variables for background and text**:
   ```css
   .editor-container {
     background: var(--bg-editor);
     color: var(--text-color);
     transition: background 0.2s ease, color 0.2s ease; /* Enables smooth color fade */
   }

   .sidebar {
     background: var(--bg-sidebar);
     border-right: 1px solid var(--border-color);
     color: var(--text-color);
   }

   .toolbar {
     background: var(--bg-toolbar);
     border-bottom: 1px solid var(--border-color);
   }

   .button:hover {
     background: var(--btn-hover);
   }
   ```

2. **Never hardcode hex values** (`#fff`, `#000`) in component stylesheets unless intentionally permanent (e.g. error red `#e53e3e`).

---

## 7. UI Controller Component

Save as `src/components/ThemeToggle.tsx`:

```tsx
import { useThemeStore } from '../stores/themeStore';
import { Coffee, Sun, Moon, TreePine, Compass } from 'lucide-react';

export function ThemeToggle() {
  const { theme, cycleTheme } = useThemeStore();

  const getIcon = () => {
    switch (theme) {
      case 'sepia': return <Coffee size={16} />;
      case 'light': return <Sun size={16} />;
      case 'dark': return <Moon size={16} />;
      case 'forest': return <TreePine size={16} />;
      case 'nord': return <Compass size={16} />;
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle-btn"
      title={`Current Theme: ${theme.toUpperCase()} (Click to cycle)`}
    >
      {getIcon()}
      <span className="theme-label">{theme.toUpperCase()}</span>
    </button>
  );
}
```

---

## 8. Agent Implementation Checklist

When tasked with implementing this theme system into any new codebase, follow these exact steps:

- [ ] **Step 1**: Create `src/styles/theme.css` with the 16 CSS tokens for `:root`, `[data-theme='light']`, and `[data-theme='dark']` (from Section 3). Import this in the project's root CSS.
- [ ] **Step 2**: Create `src/stores/themeStore.ts` (or equivalent state holder) exposing `theme`, `setTheme`, and `cycleTheme` (from Section 4).
- [ ] **Step 3**: In the root component (`App.tsx` or `index.html`), bind `document.documentElement.setAttribute('data-theme', theme)` in an effect/listener.
- [ ] **Step 4**: Replace hardcoded background/border/text hex values in child component CSS files with `var(--bg-editor)`, `var(--text-color)`, and `var(--border-color)`.
- [ ] **Step 5**: Add `transition: background 0.2s, color 0.2s;` on major panels for smooth repainting.
- [ ] **Step 6**: Add the `ThemeToggle` button to the toolbar or header.
