import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorState } from '@tiptap/react';
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
  BookOpenText,
  MoreHorizontal,
  Settings,
  History,
  ScrollText,
  ClipboardCopy,
  GitCommitHorizontal,
  Repeat2,
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import './Toolbar.css';

interface MenuEntry {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

/**
 * The toolbar keeps only what a novelist reaches for while drafting. Everything else (file
 * operations, rarer formatting, tools, settings) lives in the "More" menu and the command palette.
 */
export function Toolbar() {
  const s = useEditorStore(
    useShallow((st) => ({
      editor: st.editorInstance,
      newFile: st.newFile,
      openProjectFolderAction: st.openProjectFolderAction,
      saveFileAction: st.saveFileAction,
      saveFileAsAction: st.saveFileAsAction,
      printAction: st.printAction,
      syncGitAction: st.syncGitAction,
      isDirty: st.isDirty,
      sidebarOpen: st.sidebarOpen,
      toggleSidebar: st.toggleSidebar,
      viewMode: st.viewMode,
      setViewMode: st.setViewMode,
      focusMode: st.focusMode,
      toggleFocusMode: st.toggleFocusMode,
      dimUnfocused: st.dimUnfocused,
      toggleDimUnfocused: st.toggleDimUnfocused,
      typewriterMode: st.typewriterMode,
      toggleTypewriterMode: st.toggleTypewriterMode,
      setFindReplaceOpen: st.setFindReplaceOpen,
      setGoalsModalOpen: st.setGoalsModalOpen,
      setCommandPaletteOpen: st.setCommandPaletteOpen,
      corkboardOpen: st.corkboardOpen,
      toggleCorkboard: st.toggleCorkboard,
      inspectorOpen: st.inspectorOpen,
      toggleInspector: st.toggleInspector,
      hasProject: Boolean(st.novelProject),
      toggleCompileModal: st.toggleCompileModal,
      codexModalOpen: st.codexModalOpen,
      toggleCodexModal: st.toggleCodexModal,
      toggleProseAnalysis: st.toggleProseAnalysis,
      setSettingsOpen: st.setSettingsOpen,
      setBackupsOpen: st.setBackupsOpen,
      copyContextPackAction: st.copyContextPackAction,
      commitVersionAction: st.commitVersionAction,
      showEchoes: st.showEchoes,
      toggleEchoes: st.toggleEchoes,
    }))
  );
  const { editor, viewMode } = s;

  const active = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor;
      const is = (name: string, attrs?: Record<string, unknown>) => Boolean(ed?.isActive(name, attrs));
      return {
        bold: is('bold'),
        italic: is('italic'),
        underline: is('underline'),
        strike: is('strike'),
        h1: is('heading', { level: 1 }),
        h2: is('heading', { level: 2 }),
        h3: is('heading', { level: 3 }),
        bulletList: is('bulletList'),
        orderedList: is('orderedList'),
        blockquote: is('blockquote'),
        highlight: is('highlight'),
      };
    },
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menuOpen]);

  const canFormat = Boolean(editor) && viewMode !== 'preview';
  const chain = () => editor!.chain().focus();

  const sections: { title: string; entries: MenuEntry[] }[] = [
    {
      title: 'File',
      entries: [
        { label: 'New chapter', icon: <FilePlus size={15} />, shortcut: 'Ctrl+N', run: () => void s.newFile() },
        { label: 'Open novel folder…', icon: <FolderOpen size={15} />, shortcut: 'Ctrl+O', run: () => void s.openProjectFolderAction() },
        { label: 'Save as…', icon: <SaveAll size={15} />, shortcut: 'Ctrl+Shift+S', run: () => void s.saveFileAsAction() },
        { label: 'Export manuscript…', icon: <BookDown size={15} />, shortcut: 'Ctrl+E', run: s.toggleCompileModal },
        { label: 'Print / save as PDF', icon: <Printer size={15} />, shortcut: 'Ctrl+P', run: s.printAction },
        { label: 'Save a version (git)', icon: <GitCommitHorizontal size={15} />, disabled: !s.hasProject, run: () => void s.commitVersionAction() },
        { label: 'Push to GitHub', icon: <GitBranch size={15} />, run: () => void s.syncGitAction() },
        { label: 'Backups of this file…', icon: <History size={15} />, run: () => s.setBackupsOpen(true) },
      ],
    },
    {
      title: 'Format',
      entries: [
        { label: 'Chapter title (H1)', icon: <Heading1 size={15} />, active: active?.h1, disabled: !canFormat, run: () => chain().toggleHeading({ level: 1 }).run() },
        { label: 'Subheading (H3)', icon: <Heading3 size={15} />, active: active?.h3, disabled: !canFormat, run: () => chain().toggleHeading({ level: 3 }).run() },
        { label: 'Underline', icon: <Underline size={15} />, active: active?.underline, disabled: !canFormat, run: () => chain().toggleUnderline().run() },
        { label: 'Strikethrough', icon: <Strikethrough size={15} />, active: active?.strike, disabled: !canFormat, run: () => chain().toggleStrike().run() },
        { label: 'Highlight', icon: <Highlighter size={15} />, active: active?.highlight, disabled: !canFormat, run: () => chain().toggleHighlight().run() },
        { label: 'Block quote (letter, excerpt)', icon: <Quote size={15} />, active: active?.blockquote, disabled: !canFormat, run: () => chain().toggleBlockquote().run() },
        { label: 'Bullet list', icon: <List size={15} />, active: active?.bulletList, disabled: !canFormat, run: () => chain().toggleBulletList().run() },
        { label: 'Numbered list', icon: <ListOrdered size={15} />, active: active?.orderedList, disabled: !canFormat, run: () => chain().toggleOrderedList().run() },
      ],
    },
    {
      title: 'Tools',
      entries: [
        { label: 'Goals & statistics', icon: <Target size={15} />, shortcut: 'Ctrl+G', run: () => s.setGoalsModalOpen(true) },
        { label: 'Prose analysis', icon: <Sparkles size={15} />, run: s.toggleProseAnalysis },
        { label: 'Copy context for AI', icon: <ClipboardCopy size={15} />, disabled: !s.hasProject, run: () => void s.copyContextPackAction() },
        { label: 'Paragraph focus', icon: <Focus size={15} />, shortcut: 'Ctrl+Shift+P', active: s.dimUnfocused, run: s.toggleDimUnfocused },
        { label: 'Show repeated words', icon: <Repeat2 size={15} />, active: s.showEchoes, run: s.toggleEchoes },
        { label: 'Typewriter scrolling', icon: <ScrollText size={15} />, shortcut: 'Ctrl+Shift+T', active: s.typewriterMode, run: s.toggleTypewriterMode },
        { label: 'Command palette', icon: <CommandIcon size={15} />, shortcut: 'Ctrl+K', run: () => s.setCommandPaletteOpen(true) },
        { label: 'Settings…', icon: <Settings size={15} />, shortcut: 'Ctrl+,', run: () => s.setSettingsOpen(true) },
      ],
    },
  ];

  const viewModes = [
    { mode: 'editor', icon: <PenTool size={15} />, title: 'Write (editor only)' },
    { mode: 'split', icon: <Columns2 size={15} />, title: 'Write + typeset preview' },
    { mode: 'preview', icon: <BookOpen size={15} />, title: 'Read (preview only)' },
    { mode: 'scratchpad', icon: <StickyNote size={15} />, title: 'Write + scratchpad' },
    { mode: 'reference', icon: <BookOpenText size={15} />, title: 'Write + notes or another chapter (read-only)' },
  ] as const;

  return (
    <div className="toolbar" role="toolbar" aria-label="Main toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${s.sidebarOpen ? 'active' : ''}`}
          onClick={s.toggleSidebar}
          title={s.sidebarOpen ? 'Hide sidebar (Ctrl+\\)' : 'Show sidebar (Ctrl+\\)'}
          aria-label="Toggle sidebar"
          aria-pressed={s.sidebarOpen}
        >
          <PanelLeft size={18} />
        </button>
        <button
          className={`toolbar-button ${s.isDirty ? 'has-changes' : ''}`}
          onClick={() => void s.saveFileAction()}
          title={s.isDirty ? 'Save now (Ctrl+S): unsaved changes' : 'Saved (Ctrl+S)'}
          aria-label="Save"
        >
          <Save size={18} />
        </button>
      </div>

      {canFormat && (
        <>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button
              className={`toolbar-button ${active?.bold ? 'active' : ''}`}
              onClick={() => chain().toggleBold().run()}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
              aria-pressed={active?.bold}
            >
              <Bold size={18} />
            </button>
            <button
              className={`toolbar-button ${active?.italic ? 'active' : ''}`}
              onClick={() => chain().toggleItalic().run()}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
              aria-pressed={active?.italic}
            >
              <Italic size={18} />
            </button>
            <button
              className={`toolbar-button ${active?.h2 ? 'active' : ''}`}
              onClick={() => chain().toggleHeading({ level: 2 }).run()}
              title="Scene heading (## starts a new scene)"
              aria-label="Scene heading"
              aria-pressed={active?.h2}
            >
              <Heading2 size={18} />
            </button>
            <button
              className="toolbar-button"
              onClick={() => chain().setHorizontalRule().run()}
              title="Scene break (✦ ✦ ✦)"
              aria-label="Insert scene break"
            >
              <Minus size={18} />
            </button>
          </div>
        </>
      )}

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="toolbar-button" onClick={() => s.setFindReplaceOpen(true)} title="Find & replace (Ctrl+F)" aria-label="Find and replace">
          <Search size={17} />
        </button>
        <button
          className={`toolbar-button ${s.corkboardOpen ? 'active' : ''}`}
          onClick={s.toggleCorkboard}
          title="Corkboard: scenes as index cards"
          aria-label="Corkboard"
          aria-pressed={s.corkboardOpen}
        >
          <LayoutGrid size={17} />
        </button>
        <button
          className={`toolbar-button ${s.inspectorOpen ? 'active' : ''}`}
          onClick={s.toggleInspector}
          title="Inspector: notes for this scene or chapter"
          aria-label="Inspector"
          aria-pressed={s.inspectorOpen}
        >
          <SlidersHorizontal size={17} />
        </button>
        {s.hasProject && (
          <button
            className={`toolbar-button ${s.codexModalOpen ? 'active' : ''}`}
            onClick={s.toggleCodexModal}
            title="Story bible: characters, places, lore"
            aria-label="Story bible"
            aria-pressed={s.codexModalOpen}
          >
            <BookMarked size={17} />
          </button>
        )}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          className={`toolbar-button ${s.focusMode ? 'active' : ''}`}
          onClick={s.toggleFocusMode}
          title="Distraction-free mode (F11)"
          aria-label="Distraction-free mode"
        >
          <Maximize2 size={16} />
        </button>
        <ThemeToggle />
      </div>

      <div className="toolbar-group segmented-control view-modes" role="group" aria-label="View">
        {viewModes.map((v) => (
          <button
            key={v.mode}
            className={`toolbar-button ${viewMode === v.mode ? 'active' : ''}`}
            onClick={() => s.setViewMode(v.mode)}
            title={v.title}
            aria-label={v.title}
            aria-pressed={viewMode === v.mode}
          >
            {v.icon}
          </button>
        ))}
      </div>

      <div className="toolbar-more" ref={menuRef}>
        <button
          className={`toolbar-button ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          title="More: file, formatting, tools, settings"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="toolbar-menu" role="menu">
            {sections.map((section) => (
              <div key={section.title} className="toolbar-menu-section">
                <div className="toolbar-menu-heading">{section.title}</div>
                {section.entries.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    role="menuitem"
                    className={`toolbar-menu-item ${entry.active ? 'active' : ''}`}
                    disabled={entry.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      entry.run();
                    }}
                  >
                    {entry.icon}
                    <span className="toolbar-menu-label">{entry.label}</span>
                    {entry.shortcut && <kbd className="toolbar-menu-shortcut">{entry.shortcut}</kbd>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
