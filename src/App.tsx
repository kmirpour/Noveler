import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { Preview } from './components/Preview/Preview';
import { StatusBar } from './components/StatusBar/StatusBar';
import { FindReplace } from './components/FindReplace/FindReplace';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { GoalsModal } from './components/GoalsModal/GoalsModal';
import { Corkboard } from './components/Corkboard/Corkboard';
import { Inspector } from './components/Inspector/Inspector';
import { CompileModal } from './components/CompileModal/CompileModal';
import { CodexModal } from './components/Codex/CodexModal';
import { ProseAnalysisModal } from './components/ProseAnalysis/ProseAnalysisModal';
import { Scratchpad } from './components/Scratchpad/Scratchpad';
import { Reference } from './components/Reference/Reference';
import { DialogHost } from './components/Dialog/DialogHost';
import { SettingsModal } from './components/Settings/SettingsModal';
import { BackupsModal } from './components/Settings/BackupsModal';
import { Welcome } from './components/Welcome/Welcome';
import { applyTheme } from './services/themes';
import { useEditorStore } from './stores/editorStore';
import { useEffect, useState } from 'react';
import { wordsToday } from './utils/writingLog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { Minimize2 } from 'lucide-react';

function App() {
  useKeyboardShortcuts();
  useAppLifecycle();
  const theme = useEditorStore((s) => s.theme);
  const viewMode = useEditorStore((s) => s.viewMode);
  const focusMode = useEditorStore((s) => s.focusMode);
  const setFocusMode = useEditorStore((s) => s.setFocusMode);
  const dailyWordGoal = useEditorStore((s) => s.dailyWordGoal);
  const todayWords = useEditorStore((s) => wordsToday(s.writingLog));
  const [pointerActive, setPointerActive] = useState(false);

  // In focus mode the controls stay out of sight until the mouse moves.
  useEffect(() => {
    if (!focusMode) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMove = () => {
      setPointerActive(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPointerActive(false), 2000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (timer) clearTimeout(timer);
      setPointerActive(false);
    };
  }, [focusMode]);

  const goalPercent = dailyWordGoal > 0 ? Math.min(100, (todayWords / dailyWordGoal) * 100) : 0;

  // Sync theme with root DOM attribute for zero-re-render CSS variable cascade
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''} ${focusMode && pointerActive ? 'pointer-active' : ''}`}>
      {!focusMode && <Toolbar />}
      <div className="app-body">
        {!focusMode && <Sidebar />}
        <main className="app-main">
          {viewMode !== 'preview' && (
            <div
              className={`pane editor-pane ${viewMode === 'split' || viewMode === 'scratchpad' || viewMode === 'reference' ? 'split' : 'full'}`}
            >
              <Editor />
            </div>
          )}
          {viewMode !== 'editor' && viewMode !== 'scratchpad' && viewMode !== 'reference' && (
            <div className={`pane preview-pane ${viewMode === 'split' ? 'split' : 'full'}`}>
              <Preview />
            </div>
          )}
          {viewMode === 'reference' && (
            <div className="pane reference-pane split">
              <Reference />
            </div>
          )}
          {viewMode === 'scratchpad' && (
            <div className="pane scratchpad-pane split">
              <Scratchpad />
            </div>
          )}
        </main>
        {!focusMode && <Inspector />}
        <Welcome />
      </div>
      {!focusMode && <StatusBar />}

      {/* Unobtrusive exit button when in distraction-free focus mode */}
      {focusMode && dailyWordGoal > 0 && (
        <div
          className={`focus-goal-line ${goalPercent >= 100 ? 'met' : ''}`}
          role="progressbar"
          aria-label="Today's words toward the daily goal"
          aria-valuemin={0}
          aria-valuemax={dailyWordGoal}
          aria-valuenow={Math.min(todayWords, dailyWordGoal)}
          title={`${todayWords.toLocaleString()} of ${dailyWordGoal.toLocaleString()} words today`}
        >
          <span style={{ width: `${goalPercent}%` }} />
        </div>
      )}
      {focusMode && (
        <button
          className="exit-focus-btn"
          onClick={() => setFocusMode(false)}
          title="Exit Focus Mode (Esc / F11)"
        >
          <Minimize2 size={15} />
          <span>Exit Focus</span>
        </button>
      )}

      {/* Writing Experience Overlays */}
      <FindReplace />
      <CommandPalette />
      <GoalsModal />
      <Corkboard />
      <CompileModal />
      <CodexModal />
      <ProseAnalysisModal />
      <SettingsModal />
      <BackupsModal />
      <DialogHost />
    </div>
  );
}


export default App;
