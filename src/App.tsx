import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { Preview } from './components/Preview/Preview';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useEditorStore } from './stores/editorStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  useKeyboardShortcuts();
  const { viewMode } = useEditorStore();

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <Sidebar />
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
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
