import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  FileDown,
  Printer,
  FolderTree,
  Maximize2,
  ScrollText,
  Eye,
  Target,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Quote,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Sun,
  Moon,
  Coffee,
  Type,
  AlignLeft,
  Columns2,
  BookOpen,
  PenTool,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  category: 'File' | 'View & Focus' | 'Formatting' | 'Typography' | 'Theme';
  title: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    editorInstance,
    newFile,
    openFileAction,
    saveFileAction,
    saveFileAsAction,
    exportDocxAction,
    printAction,
    openProjectFolderAction,
    toggleFocusMode,
    toggleTypewriterMode,
    toggleDimUnfocused,
    setGoalsModalOpen,
    setFindReplaceOpen,
    setViewMode,
    toggleSidebar,
    cycleFontFamily,
    toggleParagraphIndent,
    setFontSize,
    fontSize,
    setTheme,
  } = useEditorStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Command definitions
  const commands: CommandItem[] = useMemo(
    () => [
      // File
      {
        id: 'file-new',
        category: 'File',
        title: 'New Document',
        shortcut: 'Ctrl+N',
        icon: <FilePlus size={16} />,
        action: () => void newFile(),
      },
      {
        id: 'file-open',
        category: 'File',
        title: 'Open File...',
        shortcut: 'Ctrl+O',
        icon: <FolderOpen size={16} />,
        action: () => void openFileAction(),
      },
      {
        id: 'file-save',
        category: 'File',
        title: 'Save File',
        shortcut: 'Ctrl+S',
        icon: <Save size={16} />,
        action: () => void saveFileAction(),
      },
      {
        id: 'file-save-as',
        category: 'File',
        title: 'Save As...',
        shortcut: 'Ctrl+Shift+S',
        icon: <SaveAll size={16} />,
        action: () => void saveFileAsAction(),
      },
      {
        id: 'file-export-docx',
        category: 'File',
        title: 'Export Manuscript to Word (DOCX)',
        icon: <FileDown size={16} />,
        action: () => void exportDocxAction(),
      },
      {
        id: 'file-print',
        category: 'File',
        title: 'Print / Save as PDF',
        shortcut: 'Ctrl+P',
        icon: <Printer size={16} />,
        action: () => printAction(),
      },
      {
        id: 'file-open-project',
        category: 'File',
        title: 'Open Project Folder...',
        icon: <FolderTree size={16} />,
        action: () => void openProjectFolderAction(),
      },

      // View & Focus
      {
        id: 'focus-toggle',
        category: 'View & Focus',
        title: 'Toggle Focus Mode (Distraction-Free)',
        shortcut: 'F11 / Ctrl+Shift+F',
        icon: <Maximize2 size={16} />,
        action: () => toggleFocusMode(),
      },
      {
        id: 'typewriter-toggle',
        category: 'View & Focus',
        title: 'Toggle Typewriter Scrolling (Center Cursor)',
        shortcut: 'Ctrl+Shift+T',
        icon: <ScrollText size={16} />,
        action: () => toggleTypewriterMode(),
      },
      {
        id: 'dim-toggle',
        category: 'View & Focus',
        title: 'Toggle Dim Inactive Paragraphs',
        icon: <Eye size={16} />,
        action: () => toggleDimUnfocused(),
      },
      {
        id: 'goals-open',
        category: 'View & Focus',
        title: 'Writing Goals & Statistics',
        shortcut: 'Ctrl+G',
        icon: <Target size={16} />,
        action: () => setGoalsModalOpen(true),
      },
      {
        id: 'search-open',
        category: 'View & Focus',
        title: 'Find & Replace in Manuscript',
        shortcut: 'Ctrl+F',
        icon: <Search size={16} />,
        action: () => setFindReplaceOpen(true),
      },
      {
        id: 'view-editor',
        category: 'View & Focus',
        title: 'View: Write (Editor Only)',
        icon: <PenTool size={16} />,
        action: () => setViewMode('editor'),
      },
      {
        id: 'view-split',
        category: 'View & Focus',
        title: 'View: Split (Editor + Live Preview)',
        icon: <Columns2 size={16} />,
        action: () => setViewMode('split'),
      },
      {
        id: 'view-preview',
        category: 'View & Focus',
        title: 'View: Read (Preview Only)',
        icon: <BookOpen size={16} />,
        action: () => setViewMode('preview'),
      },
      {
        id: 'view-sidebar',
        category: 'View & Focus',
        title: 'Toggle Project Sidebar',
        icon: <FolderTree size={16} />,
        action: () => toggleSidebar(),
      },

      // Formatting
      {
        id: 'fmt-h1',
        category: 'Formatting',
        title: 'Format: Heading 1 (Book / Part Title)',
        shortcut: '#',
        icon: <Heading1 size={16} />,
        action: () => editorInstance?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'fmt-h2',
        category: 'Formatting',
        title: 'Format: Heading 2 (Chapter Title)',
        shortcut: '##',
        icon: <Heading2 size={16} />,
        action: () => editorInstance?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'fmt-h3',
        category: 'Formatting',
        title: 'Format: Heading 3 (Subheading / Scene Title)',
        shortcut: '###',
        icon: <Heading3 size={16} />,
        action: () => editorInstance?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'fmt-scene-break',
        category: 'Formatting',
        title: 'Insert Scene Break (* * *)',
        shortcut: '---',
        icon: <Minus size={16} />,
        action: () => editorInstance?.chain().focus().setHorizontalRule().run(),
      },
      {
        id: 'fmt-blockquote',
        category: 'Formatting',
        title: 'Format: Blockquote (Letter / Journal Entry)',
        shortcut: '>',
        icon: <Quote size={16} />,
        action: () => editorInstance?.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'fmt-bold',
        category: 'Formatting',
        title: 'Format: Bold',
        shortcut: 'Ctrl+B',
        icon: <Bold size={16} />,
        action: () => editorInstance?.chain().focus().toggleBold().run(),
      },
      {
        id: 'fmt-italic',
        category: 'Formatting',
        title: 'Format: Italic',
        shortcut: 'Ctrl+I',
        icon: <Italic size={16} />,
        action: () => editorInstance?.chain().focus().toggleItalic().run(),
      },
      {
        id: 'fmt-underline',
        category: 'Formatting',
        title: 'Format: Underline',
        shortcut: 'Ctrl+U',
        icon: <Underline size={16} />,
        action: () => editorInstance?.chain().focus().toggleUnderline().run(),
      },
      {
        id: 'fmt-highlight',
        category: 'Formatting',
        title: 'Format: Highlight',
        icon: <Highlighter size={16} />,
        action: () => editorInstance?.chain().focus().toggleHighlight().run(),
      },

      // Typography
      {
        id: 'typo-font',
        category: 'Typography',
        title: 'Cycle Font Family (Serif / Sans / Monospace)',
        icon: <Type size={16} />,
        action: () => cycleFontFamily(),
      },
      {
        id: 'typo-indent',
        category: 'Typography',
        title: 'Toggle Paragraph Style (Fiction First-Line Indent vs Block)',
        icon: <AlignLeft size={16} />,
        action: () => toggleParagraphIndent(),
      },
      {
        id: 'typo-font-plus',
        category: 'Typography',
        title: 'Increase Font Size',
        icon: <Type size={16} />,
        action: () => setFontSize(Math.min(32, fontSize + 1)),
      },
      {
        id: 'typo-font-minus',
        category: 'Typography',
        title: 'Decrease Font Size',
        icon: <Type size={16} />,
        action: () => setFontSize(Math.max(12, fontSize - 1)),
      },

      // Theme
      {
        id: 'theme-light',
        category: 'Theme',
        title: 'Theme: Light (Clean Studio)',
        icon: <Sun size={16} />,
        action: () => setTheme('light'),
      },
      {
        id: 'theme-dark',
        category: 'Theme',
        title: 'Theme: Dark (Midnight)',
        icon: <Moon size={16} />,
        action: () => setTheme('dark'),
      },
      {
        id: 'theme-sepia',
        category: 'Theme',
        title: 'Theme: Sepia (Warm Parchment)',
        icon: <Coffee size={16} />,
        action: () => setTheme('sepia'),
      },
    ],
    [
      editorInstance,
      newFile,
      openFileAction,
      saveFileAction,
      saveFileAsAction,
      exportDocxAction,
      printAction,
      openProjectFolderAction,
      toggleFocusMode,
      toggleTypewriterMode,
      toggleDimUnfocused,
      setGoalsModalOpen,
      setFindReplaceOpen,
      setViewMode,
      toggleSidebar,
      cycleFontFamily,
      toggleParagraphIndent,
      setFontSize,
      fontSize,
      setTheme,
    ]
  );

  // Filter commands
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(q))
    );
  }, [commands, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [commandPaletteOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.palette-item.selected') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const executeCommand = (cmd: CommandItem) => {
    setCommandPaletteOpen(false);
    setTimeout(() => {
      cmd.action();
    }, 20);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0 ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="modal-backdrop palette-backdrop" onClick={() => setCommandPaletteOpen(false)}>
      <div className="command-palette-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="palette-input-row">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="palette-kbd">ESC</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="palette-empty">No matching commands found</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="palette-item-icon">{cmd.icon}</div>
                <div className="palette-item-info">
                  <span className="palette-item-title">{cmd.title}</span>
                  <span className="palette-item-category">{cmd.category}</span>
                </div>
                {cmd.shortcut && <kbd className="palette-item-shortcut">{cmd.shortcut}</kbd>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
