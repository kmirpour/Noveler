import { useEditorStore } from '../../stores/editorStore';
import {
  PanelLeft,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  BookDown,
  Printer,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Highlighter,
  Type,
  AlignLeft,
  Columns2,
  BookOpen,
  PenTool,
  Search,
  Target,
  Command as CommandIcon,
  Maximize2,
  LayoutGrid,
  SlidersHorizontal,
  BookMarked,
  Sparkles,
  StickyNote,
  Focus,
  GitBranch,
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import './Toolbar.css';

export function Toolbar() {
  const {
    editorInstance: editor,
    newFile,
    openProjectFolderAction,
    saveFileAction,
    saveFileAsAction,
    printAction,
    syncGitAction,
    isDirty,
    sidebarOpen,
    toggleSidebar,
    viewMode,
    setViewMode,
    fontFamily,
    cycleFontFamily,
    paragraphIndent,
    toggleParagraphIndent,
    focusMode,
    toggleFocusMode,
    dimUnfocused,
    toggleDimUnfocused,
    setFindReplaceOpen,
    setGoalsModalOpen,
    setCommandPaletteOpen,
    corkboardOpen,
    toggleCorkboard,
    inspectorOpen,
    toggleInspector,
    novelProject,
    toggleCompileModal,
    codexModalOpen,
    toggleCodexModal,
    proseAnalysisOpen,
    toggleProseAnalysis,
  } = useEditorStore();

  return (
    <div className="toolbar">
      {/* Sidebar Toggle */}
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${sidebarOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* File Operations */}
      <div className="toolbar-group file-actions">
        <button
          className="toolbar-button"
          onClick={() => void newFile()}
          title="New Chapter (Ctrl+N)"
        >
          <FilePlus size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => void openProjectFolderAction()}
          title="Open Novel Folder (Ctrl+O)"
        >
          <FolderOpen size={18} />
        </button>
        <button
          className={`toolbar-button ${isDirty ? 'has-changes' : ''}`}
          onClick={() => void saveFileAction()}
          title={isDirty ? 'Save Changes (Ctrl+S) • Unsaved' : 'Save File (Ctrl+S)'}
        >
          <Save size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => void saveFileAsAction()}
          title="Save As... (Ctrl+Shift+S)"
        >
          <SaveAll size={18} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Export Operations */}
      <div className="toolbar-group export-actions">
        <button
          className="toolbar-button"
          onClick={toggleCompileModal}
          title="Export Manuscript (Ctrl+E)"
        >
          <BookDown size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => printAction()}
          title="Print / Save as PDF (Ctrl+P)"
        >
          <Printer size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => void syncGitAction()}
          title="Push Manuscript to GitHub"
        >
          <GitBranch size={18} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Formatting Operations */}
      {editor && viewMode !== 'preview' && (
        <>
          <div className="toolbar-group">
            <button
              className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <Bold size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <Italic size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
            >
              <Underline size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
            >
              <Strikethrough size={18} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              className={`toolbar-button ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1 (Book / Part Title)"
            >
              <Heading1 size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2 (Chapter Title)"
            >
              <Heading2 size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3 (Section Title)"
            >
              <Heading3 size={18} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              className={`toolbar-button ${editor.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
            >
              <List size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Ordered List"
            >
              <ListOrdered size={18} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              className={`toolbar-button ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Blockquote (Letter / Excerpt)"
            >
              <Quote size={18} />
            </button>
            <button
              className="toolbar-button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Scene Break (* * *)"
            >
              <Minus size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('highlight') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Highlight"
            >
              <Highlighter size={18} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Typography Settings */}
          <div className="toolbar-group">
            <button
              className="toolbar-button"
              onClick={cycleFontFamily}
              title={`Font Family: ${fontFamily === 'serif' ? 'Serif (Georgia)' : fontFamily === 'sans' ? 'Sans-Serif (System)' : 'Monospace (Consolas)'}`}
            >
              <Type size={17} />
            </button>
            <button
              className={`toolbar-button ${paragraphIndent ? 'active' : ''}`}
              onClick={toggleParagraphIndent}
              title={`Paragraph Style: ${paragraphIndent ? 'Fiction First-Line Indents' : 'Web Block Spacing'}`}
            >
              <AlignLeft size={17} />
            </button>
          </div>
        </>
      )}

      <div className="toolbar-separator" />

      {/* Writing Tools */}
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => setFindReplaceOpen(true)}
          title="Find & Replace (Ctrl+F)"
        >
          <Search size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => setGoalsModalOpen(true)}
          title="Writing Goals & Statistics (Ctrl+G)"
        >
          <Target size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => setCommandPaletteOpen(true)}
          title="Command Palette (Ctrl+K)"
        >
          <CommandIcon size={16} />
        </button>
        <button
          className={`toolbar-button ${dimUnfocused ? 'active' : ''}`}
          onClick={toggleDimUnfocused}
          title={`Paragraph Focus Mode (${dimUnfocused ? 'Active' : 'Inactive'}) (Ctrl+Shift+P)`}
        >
          <Focus size={16} />
        </button>
        <button
          className={`toolbar-button ${focusMode ? 'active' : ''}`}
          onClick={toggleFocusMode}
          title="Distraction-Free Focus Mode (F11 / Ctrl+Shift+F)"
        >
          <Maximize2 size={16} />
        </button>
        <button
          className={`toolbar-button ${corkboardOpen ? 'active' : ''}`}
          onClick={toggleCorkboard}
          title="Corkboard & Outline View"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          className={`toolbar-button ${inspectorOpen ? 'active' : ''}`}
          onClick={toggleInspector}
          title="Scene Inspector (Synopsis, POV, Status)"
        >
          <SlidersHorizontal size={16} />
        </button>
        {novelProject && (
          <button
            className={`toolbar-button ${codexModalOpen ? 'active' : ''}`}
            onClick={toggleCodexModal}
            title="Story Bible & Codex (Characters, Locations, Lore)"
          >
            <BookMarked size={16} />
          </button>
        )}
        <button
          className={`toolbar-button ${proseAnalysisOpen ? 'active' : ''}`}
          onClick={toggleProseAnalysis}
          title="Prose Diagnostics & Style Analysis"
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* Flexible Spacer */}
      <div className="toolbar-spacer" />

      {/* Theme Switcher */}
      <div className="toolbar-group">
        <ThemeToggle />
      </div>

      <div className="toolbar-separator" />

      {/* View Mode Switcher */}
      <div className="toolbar-group segmented-control view-modes">
        <button
          className={`toolbar-button ${viewMode === 'editor' ? 'active' : ''}`}
          onClick={() => setViewMode('editor')}
          title="Pen Mode (Editor Only)"
        >
          <PenTool size={15} />
        </button>
        <button
          className={`toolbar-button ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => setViewMode('split')}
          title="Split Mode (Editor + Live Preview)"
        >
          <Columns2 size={15} />
        </button>
        <button
          className={`toolbar-button ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
          title="Eye Mode (Preview Only)"
        >
          <BookOpen size={15} />
        </button>
        <button
          className={`toolbar-button ${viewMode === 'scratchpad' ? 'active' : ''}`}
          onClick={() => setViewMode('scratchpad')}
          title="Pen & Scratchpad Mode (Editor + Scratchpad)"
        >
          <StickyNote size={15} />
        </button>
      </div>
    </div>
  );
}
