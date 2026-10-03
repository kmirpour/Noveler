import { useEditorStore } from '../../stores/editorStore';
import {
  PanelLeft,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  FileDown,
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
  Sun,
  Moon,
  Coffee,
  Search,
  Target,
  Command as CommandIcon,
  Maximize2,
  LayoutGrid,
  SlidersHorizontal,
} from 'lucide-react';
import './Toolbar.css';

export function Toolbar() {
  const {
    editorInstance: editor,
    newFile,
    openFileAction,
    saveFileAction,
    saveFileAsAction,
    exportDocxAction,
    printAction,
    isDirty,
    sidebarOpen,
    toggleSidebar,
    viewMode,
    setViewMode,
    theme,
    setTheme,
    fontFamily,
    cycleFontFamily,
    paragraphIndent,
    toggleParagraphIndent,
    focusMode,
    toggleFocusMode,
    setFindReplaceOpen,
    setGoalsModalOpen,
    setCommandPaletteOpen,
    corkboardOpen,
    toggleCorkboard,
    inspectorOpen,
    toggleInspector,
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
          title="New File (Ctrl+N)"
        >
          <FilePlus size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => void openFileAction()}
          title="Open Markdown File (Ctrl+O)"
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
          onClick={() => void exportDocxAction()}
          title="Export Manuscript to Word (.docx)"
        >
          <FileDown size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => printAction()}
          title="Print / Save as PDF (Ctrl+P)"
        >
          <Printer size={18} />
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
          className={`toolbar-button ${focusMode ? 'active' : ''}`}
          onClick={toggleFocusMode}
          title="Focus Mode (F11 / Ctrl+Shift+F)"
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
      </div>

      {/* Flexible Spacer */}
      <div className="toolbar-spacer" />

      {/* Theme Switcher */}
      <div className="toolbar-group segmented-control theme-switcher">
        <button
          className={`toolbar-button ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
          title="Light Theme"
        >
          <Sun size={15} />
        </button>
        <button
          className={`toolbar-button ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
          title="Dark Theme"
        >
          <Moon size={15} />
        </button>
        <button
          className={`toolbar-button ${theme === 'sepia' ? 'active' : ''}`}
          onClick={() => setTheme('sepia')}
          title="Sepia Theme (Warm Parchment)"
        >
          <Coffee size={15} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* View Mode Switcher */}
      <div className="toolbar-group segmented-control view-modes">
        <button
          className={`toolbar-button ${viewMode === 'editor' ? 'active' : ''}`}
          onClick={() => setViewMode('editor')}
          title="Write (Editor Only)"
        >
          <PenTool size={15} />
        </button>
        <button
          className={`toolbar-button ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => setViewMode('split')}
          title="Split View (Editor + Live Preview)"
        >
          <Columns2 size={15} />
        </button>
        <button
          className={`toolbar-button ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
          title="Read (Preview Only)"
        >
          <BookOpen size={15} />
        </button>
      </div>
    </div>
  );
}
