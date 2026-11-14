/**
 * The list of colour themes. The colours themselves live in styles/theme.css
 * (one `[data-theme='id']` block each); this is the registry the UI reads.
 */
export const THEMES = [
  { id: 'sepia', label: 'Sepia', description: 'Warm book paper', kind: 'light', swatch: ['#fcfbf9', '#2e2c29', '#8b683e'] },
  { id: 'light', label: 'Light', description: 'Crisp modern paper', kind: 'light', swatch: ['#ffffff', '#1a1a2e', '#2b579a'] },
  { id: 'solarized-light', label: 'Solarized Light', description: 'Low-glare cream, cool ink', kind: 'light', swatch: ['#fdf6e3', '#475b62', '#268bd2'] },
  { id: 'rose', label: 'Rose', description: 'Soft blush paper', kind: 'light', swatch: ['#fffaf8', '#3a2c2e', '#b4536a'] },
  { id: 'typewriter', label: 'Typewriter', description: 'Grey manuscript paper, red ribbon', kind: 'light', swatch: ['#f4f3ee', '#2b2b2b', '#b3261e'] },
  { id: 'dark', label: 'Dark', description: 'Deep slate and navy', kind: 'dark', swatch: ['#161821', '#d8dbe2', '#d4a373'] },
  { id: 'forest', label: 'Forest', description: 'Calming moss and pine', kind: 'dark', swatch: ['#1f2824', '#dbe4df', '#79a88d'] },
  { id: 'nord', label: 'Nord', description: 'Cold arctic frost', kind: 'dark', swatch: ['#2e3440', '#eceff4', '#88c0d0'] },
  { id: 'solarized-dark', label: 'Solarized Dark', description: 'Deep teal, soft contrast', kind: 'dark', swatch: ['#002b36', '#a7b6b8', '#2aa198'] },
  { id: 'dracula', label: 'Dracula', description: 'Charcoal with violet', kind: 'dark', swatch: ['#282a36', '#f8f8f2', '#bd93f9'] },
  { id: 'dusk', label: 'Dusk', description: 'Violet twilight, rose accent', kind: 'dark', swatch: ['#201d2d', '#dcd7ea', '#e79ab0'] },
  { id: 'ink', label: 'Ink', description: 'True black for dark rooms', kind: 'dark', swatch: ['#050505', '#d6d6d6', '#e0b15c'] },
  { id: 'midnight-ember', label: 'Midnight Ember', description: 'Eggplant rules', kind: 'dark', swatch: ['#151719', '#fff1e4', '#f28b45'] },
] as const;

export type Theme = (typeof THEMES)[number]['id'];
export type ThemeInfo = (typeof THEMES)[number];

export const THEME_IDS: Theme[] = THEMES.map((t) => t.id);

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_IDS as string[]).includes(value);
}

export function themeInfo(id: Theme): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Applies a theme to the document: the palette, and whether it is a light or dark surface. */
export function applyTheme(id: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  root.setAttribute('data-theme-kind', themeInfo(id).kind);
}
