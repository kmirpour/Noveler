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
import { useEditorStore } from './stores/editorStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { Minimize2 } from 'lucide-react';

function App() {
  useKeyboardShortcuts();
  useAppLifecycle();
  const viewMode = useEditorStore((s) => s.viewMode);
  const focusMode = useEditorStore((s) => s.focusMode);
  const setFocusMode = useEditorStore((s) => s.setFocusMode);

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''}`}>
      {!focusMode && <Toolbar />}
      <div className="app-body">
        {!focusMode && <Sidebar />}
        <main className="app-main">
          {viewMode !== 'preview' && (
            <div className={`pane editor-pane ${viewMode === 'split' ? 'split' : 'full'}`}>
              <Editor />
            </div>
          )}
          {viewMode !== 'editor' && (
            <div className={`pane preview-pane ${viewMode === 'split' ? 'split' : 'full'}`}>
              <Preview />
            </div>
          )}
        </main>
        {!focusMode && <Inspector />}
      </div>
      {!focusMode && <StatusBar />}

      {/* Unobtrusive exit button when in distraction-free focus mode */}
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
    </div>
  );
}


export default App;
