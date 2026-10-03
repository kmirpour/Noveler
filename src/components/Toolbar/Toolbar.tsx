import { useEditorStore } from '../../stores/editorStore';
import { exportToDocx } from '../../export/docx';
import { exportToPdf } from '../../export/pdf';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Columns2,
  BookOpen,
  PenTool,
  Sun,
  Moon,
  Coffee,
} from 'lucide-react';
import './Toolbar.css';

export function Toolbar() {
  const {
    editorInstance: editor,
    newFile,
    openFileAction,
    saveFileAction,
    saveFileAsAction,
    isDirty,
    sidebarOpen,
    toggleSidebar,
    viewMode,
    setViewMode,
    theme,
    setTheme,
    markdownContent,
    fileName,
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
          onClick={() => newFile()}
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
          onClick={() => void exportToDocx(markdownContent, fileName || 'manuscript.docx')}
          title="Export Manuscript to Word (.docx)"
        >
          <FileDown size={18} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => exportToPdf()}
          title="Print / Save as PDF (.pdf)"
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
              title="Heading 1"
            >
              <Heading1 size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <Heading2 size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
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
              title="Blockquote"
            >
              <Quote size={18} />
            </button>
            <button
              className="toolbar-button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
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

          <div className="toolbar-group">
            <button
              className={`toolbar-button ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Align Left"
            >
              <AlignLeft size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="Align Center"
            >
              <AlignCenter size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Align Right"
            >
              <AlignRight size={18} />
            </button>
            <button
              className={`toolbar-button ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              title="Justify"
            >
              <AlignJustify size={18} />
            </button>
          </div>
        </>
      )}

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
