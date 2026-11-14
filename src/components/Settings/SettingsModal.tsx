import { useShallow } from 'zustand/react/shallow';
import { Settings, X, Check } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import {
  TYPEFACES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  LINE_WIDTH_RANGE,
  typefaceInfo,
  type FontFamily,
  type SceneTitleMode,
} from '../../services/settings';
import { THEMES } from '../../services/themes';
import { ThemeSwatch } from '../ThemeToggle/ThemeToggle';
import { appMode } from '../../services/appMode';
import './SettingsModal.css';

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="settings-toggle-text">
        <span className="settings-toggle-label">{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </span>
    </label>
  );
}

/** One place for how the app looks and behaves. Every change applies immediately and is remembered. */
export function SettingsModal() {
  const s = useEditorStore(
    useShallow((st) => ({
      open: st.settingsOpen,
      setOpen: st.setSettingsOpen,
      theme: st.theme,
      setTheme: st.setTheme,
      fontFamily: st.fontFamily,
      setFontFamily: st.setFontFamily,
      fontSize: st.fontSize,
      setFontSize: st.setFontSize,
      lineHeight: st.lineHeight,
      setLineHeight: st.setLineHeight,
      lineWidth: st.lineWidth,
      setLineWidth: st.setLineWidth,
      paragraphIndent: st.paragraphIndent,
      toggleParagraphIndent: st.toggleParagraphIndent,
      sceneTitleMode: st.sceneTitleMode,
      setSceneTitleMode: st.setSceneTitleMode,
      smartQuotes: st.smartQuotes,
      setSmartQuotes: st.setSmartQuotes,
      autoSaveEnabled: st.autoSaveEnabled,
      setAutoSaveEnabled: st.setAutoSaveEnabled,
      typewriterMode: st.typewriterMode,
      toggleTypewriterMode: st.toggleTypewriterMode,
      dimUnfocused: st.dimUnfocused,
      toggleDimUnfocused: st.toggleDimUnfocused,
      spellCheckEnabled: st.spellCheckEnabled,
      toggleSpellCheck: st.toggleSpellCheck,
      onlineGrammarCheck: st.onlineGrammarCheck,
      toggleOnlineGrammarCheck: st.toggleOnlineGrammarCheck,
    }))
  );

  if (!s.open) return null;

  const typeface = typefaceInfo(s.fontFamily);
  const kinds = Array.from(new Set(TYPEFACES.map((t) => t.kind)));

  return (
    <div className="modal-backdrop" onClick={() => s.setOpen(false)}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Settings className="modal-title-icon" size={20} />
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="modal-close-btn" onClick={() => s.setOpen(false)} title="Close (Esc)" aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-heading">Theme</h3>
            <div className="settings-theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`settings-theme-card ${t.id === s.theme ? 'active' : ''}`}
                  onClick={() => s.setTheme(t.id)}
                  aria-pressed={t.id === s.theme}
                  title={t.description}
                >
                  <ThemeSwatch theme={t} />
                  <span className="settings-theme-name">{t.label}</span>
                  {t.id === s.theme && <Check size={13} className="settings-theme-check" />}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-heading">Page</h3>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-typeface">
                Typeface
              </label>
              <select
                id="settings-typeface"
                className="settings-select"
                value={s.fontFamily}
                onChange={(e) => s.setFontFamily(e.target.value as FontFamily)}
              >
                {kinds.map((kind) => (
                  <optgroup key={kind} label={kind}>
                    {TYPEFACES.filter((t) => t.kind === kind).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-size">
                Text size
              </label>
              <input
                id="settings-size"
                type="range"
                min={FONT_SIZE_RANGE.min}
                max={FONT_SIZE_RANGE.max}
                step={1}
                value={s.fontSize}
                onChange={(e) => s.setFontSize(Number(e.target.value))}
              />
              <span className="settings-value">{s.fontSize} px</span>
            </div>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-leading">
                Line spacing
              </label>
              <input
                id="settings-leading"
                type="range"
                min={LINE_HEIGHT_RANGE.min}
                max={LINE_HEIGHT_RANGE.max}
                step={0.05}
                value={s.lineHeight}
                onChange={(e) => s.setLineHeight(Number(e.target.value))}
              />
              <span className="settings-value">{s.lineHeight.toFixed(2)}</span>
            </div>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-width">
                Line width
              </label>
              <input
                id="settings-width"
                type="range"
                min={LINE_WIDTH_RANGE.min}
                max={LINE_WIDTH_RANGE.max}
                step={20}
                value={s.lineWidth}
                onChange={(e) => s.setLineWidth(Number(e.target.value))}
              />
              <span className="settings-value">{s.lineWidth} px</span>
            </div>

            <p
              className="settings-sample"
              style={{ fontFamily: typeface.stack, fontSize: Math.min(s.fontSize, 22), lineHeight: s.lineHeight }}
            >
              The bus was late, which was the only reliable thing about it. “You are speaking with OTTO,” said
              the kiosk.
            </p>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-paragraphs">
                Paragraphs
              </label>
              <select
                id="settings-paragraphs"
                className="settings-select"
                value={s.paragraphIndent ? 'indent' : 'block'}
                onChange={(e) => {
                  if ((e.target.value === 'indent') !== s.paragraphIndent) s.toggleParagraphIndent();
                }}
              >
                <option value="indent">Book style: first-line indent</option>
                <option value="block">Web style: space between paragraphs</option>
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label" htmlFor="settings-scenes">
                Scene headings
              </label>
              <select
                id="settings-scenes"
                className="settings-select"
                value={s.sceneTitleMode}
                onChange={(e) => s.setSceneTitleMode(e.target.value as SceneTitleMode)}
              >
                <option value="show">Show scene titles</option>
                <option value="stars">Show *** instead of titles</option>
                <option value="hide">Hide scene titles</option>
              </select>
            </div>
            <p className="settings-hint">
              Display only. Your chapter files always keep their plain <code>##</code> scene headings.
            </p>
          </section>

          <section className="settings-section">
            <h3 className="settings-heading">Writing</h3>
            <Toggle
              label="Save automatically"
              hint={
                appMode() === 'basic'
                  ? 'This browser cannot save straight to your files, so nothing is saved automatically. Use Save to download your work.'
                  : 'Saves about a second after you stop typing, and whenever you switch chapters.'
              }
              checked={s.autoSaveEnabled}
              onChange={s.setAutoSaveEnabled}
            />
            <Toggle
              label="Curly quotes as you type"
              hint="Turns straight quotes into “ ” and ‘ ’. Dashes and ellipses are always tidied."
              checked={s.smartQuotes}
              onChange={s.setSmartQuotes}
            />
            <Toggle
              label="Typewriter scrolling"
              hint="Keeps the line you are writing in the middle of the window."
              checked={s.typewriterMode}
              onChange={() => s.toggleTypewriterMode()}
            />
            <Toggle
              label="Paragraph focus"
              hint="Dims every paragraph except the one you are in."
              checked={s.dimUnfocused}
              onChange={() => s.toggleDimUnfocused()}
            />
          </section>

          <section className="settings-section">
            <h3 className="settings-heading">Spelling & privacy</h3>
            <Toggle
              label="Check spelling and grammar"
              hint="Runs on this computer with a built-in English dictionary. Names in your story bible, and words you add from the right-click menu, are never flagged."
              checked={s.spellCheckEnabled}
              onChange={() => s.toggleSpellCheck()}
            />
            <Toggle
              label="Online grammar check (LanguageTool)"
              hint="A deeper check, but it sends the paragraph you are editing to languagetool.org. Leave off to keep your manuscript on this computer."
              checked={s.onlineGrammarCheck}
              onChange={() => s.toggleOnlineGrammarCheck()}
            />
          </section>

          {appMode() !== 'desktop' && (
            <section className="settings-section">
              <h3 className="settings-heading">About this web version</h3>
              {import.meta.env.VITE_APP_VERSION && (
                <p className="settings-hint">Noveler web {import.meta.env.VITE_APP_VERSION}</p>
              )}
              <p className="settings-hint">
                Nothing you write is uploaded. Your novel stays in the folder on your computer, and the page only
                asks the browser for permission to read and write it. The only network requests are single-word
                thesaurus lookups when you right-click a word, and the online grammar check if you turn it on.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
