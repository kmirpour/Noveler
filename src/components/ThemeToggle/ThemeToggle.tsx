import { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { THEMES, themeInfo, type ThemeInfo } from '../../services/themes';
import './ThemeToggle.css';

export function ThemeSwatch({ theme }: { theme: ThemeInfo }) {
  const [paper, ink, accent] = theme.swatch;
  return (
    <span className="theme-swatch" style={{ background: paper }} aria-hidden="true">
      <span style={{ background: ink }} />
      <span style={{ background: accent }} />
    </span>
  );
}

/** Theme picker: a button showing the current theme, opening a list of all themes. */
export function ThemeToggle() {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const current = themeInfo(theme);

  return (
    <div className="theme-menu" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="theme-toggle-btn"
        title="Choose a colour theme (Ctrl+Shift+D cycles)"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Palette size={14} />
        <span className="theme-label">{current.label}</span>
      </button>

      {open && (
        <div className="theme-menu-popover" role="menu" aria-label="Colour theme">
          {(['light', 'dark'] as const).map((kind) => (
            <div key={kind} className="theme-menu-group">
              <div className="theme-menu-heading">{kind === 'light' ? 'Light' : 'Dark'}</div>
              {THEMES.filter((t) => t.kind === kind).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={t.id === theme}
                  className={`theme-menu-item ${t.id === theme ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <ThemeSwatch theme={t} />
                  <span className="theme-menu-text">
                    <span className="theme-menu-name">{t.label}</span>
                    <span className="theme-menu-desc">{t.description}</span>
                  </span>
                  {t.id === theme && <Check size={14} className="theme-menu-check" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
