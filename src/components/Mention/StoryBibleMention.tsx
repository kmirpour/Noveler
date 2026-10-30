import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import {
  User,
  MapPin,
  Package,
  BookMarked,
  Plus,
  BookOpen,
  X,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import type { CodexCategory } from '../../services/projectService';
import type { MentionState } from '../../extensions/storyBibleMention';
import './StoryBibleMention.css';

interface StoryBibleMentionProps {
  editor: Editor | null;
  mentionState: MentionState;
  onClose: () => void;
}

export function StoryBibleMention({ editor, mentionState, onClose }: StoryBibleMentionProps) {
  const novelProject = useEditorStore((s) => s.novelProject);
  const addCodexEntryAction = useEditorStore((s) => s.addCodexEntryAction);
  const setStatusMessage = useEditorStore((s) => s.setStatusMessage);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Quick-add form fields
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<CodexCategory>('character');
  const [newSummary, setNewSummary] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const query = mentionState.query.trim().toLowerCase();

  // Filter entries: Characters and Locations first, Items and Lore included
  const filteredEntries = useMemo(() => {
    const all = novelProject?.codex || [];
    if (!query) {
      // If no query typed yet, show all entries with Characters and Locations first
      return [...all].sort((a, b) => {
        const aPrimary = a.category === 'character' || a.category === 'location' ? 0 : 1;
        const bPrimary = b.category === 'character' || b.category === 'location' ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        return a.name.localeCompare(b.name);
      });
    }

    const matches = all.filter((entry) => {
      const nameMatch = entry.name.toLowerCase().includes(query);
      const aliasMatch = (entry.aliases || []).some((a) => a.toLowerCase().includes(query));
      return nameMatch || aliasMatch;
    });

    return matches.sort((a, b) => {
      // Prioritize Character & Location
      const aPrimary = a.category === 'character' || a.category === 'location' ? 0 : 1;
      const bPrimary = b.category === 'character' || b.category === 'location' ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;

      // Exact match priority
      const aExact = a.name.toLowerCase() === query;
      const bExact = b.name.toLowerCase() === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Prefix match priority
      const aStarts = a.name.toLowerCase().startsWith(query);
      const bStarts = b.name.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [novelProject?.codex, query]);

  // Reset selectedIndex when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Total selectable items in list mode: entries + 1 (the "+ Add New..." button)
  const totalItems = filteredEntries.length + 1;

  // Insert entity name cleanly into editor text
  const insertEntityName = useCallback((name: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: mentionState.range.from, to: mentionState.range.to },
        name + ' '
      )
      .run();
    editor.commands.closeMention();
    onClose();
  }, [editor, mentionState.range.from, mentionState.range.to, onClose]);

  const handleStartCreate = useCallback((defaultName?: string) => {
    setIsCreating(true);
    setNewName(defaultName ?? mentionState.query.trim());
    setNewCategory('character');
    setNewSummary('');
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 50);
  }, [mentionState.query]);

  const handleCreateAndInsert = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addCodexEntryAction({
      name: trimmed,
      category: newCategory,
      aliases: [],
      summary: newSummary.trim(),
      description: '',
    });
    setStatusMessage(`Added "${trimmed}" to Story Bible & Dictionary`);
    insertEntityName(trimmed);
  }, [newName, newCategory, newSummary, addCodexEntryAction, setStatusMessage, insertEntityName]);

  // Listen for keyboard events forwarded by the ProseMirror plugin
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const handleMentionKeyDown = (e: Event) => {
      const custom = e as CustomEvent<{ key: string }>;
      const key = custom.detail.key;

      if (isCreating) {
        if (key === 'Escape') {
          custom.preventDefault();
          setIsCreating(false);
        } else if (key === 'Enter') {
          custom.preventDefault();
          void handleCreateAndInsert();
        }
        return;
      }

      if (key === 'ArrowDown') {
        custom.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (key === 'ArrowUp') {
        custom.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (key === 'Enter' || key === 'Tab') {
        custom.preventDefault();
        if (selectedIndex === filteredEntries.length) {
          handleStartCreate();
        } else if (filteredEntries[selectedIndex]) {
          insertEntityName(filteredEntries[selectedIndex].name);
        }
      } else if (key === 'Escape') {
        custom.preventDefault();
        editor.commands.closeMention();
        onClose();
      }
    };

    dom.addEventListener('story-bible-mention-keydown', handleMentionKeyDown);
    return () => {
      dom.removeEventListener('story-bible-mention-keydown', handleMentionKeyDown);
    };
  }, [
    editor,
    isCreating,
    selectedIndex,
    totalItems,
    filteredEntries,
    handleCreateAndInsert,
    handleStartCreate,
    insertEntityName,
    onClose,
  ]);

  // Click outside to dismiss
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        editor?.commands.closeMention();
        onClose();
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [editor, onClose]);

  if (!mentionState.coords) return null;

  // Viewport-safe coordinates calculation
  const dropdownWidth = 320;
  const dropdownMaxHeight = isCreating ? 260 : 340;
  const left = Math.min(Math.max(16, mentionState.coords.left), window.innerWidth - dropdownWidth - 16);
  const fitsBelow = mentionState.coords.bottom + dropdownMaxHeight < window.innerHeight;
  const top = fitsBelow ? mentionState.coords.bottom + 6 : Math.max(16, mentionState.coords.top - dropdownMaxHeight - 6);

  const renderCategoryIcon = (category: CodexCategory) => {
    switch (category) {
      case 'character':
        return <User size={13} />;
      case 'location':
        return <MapPin size={13} />;
      case 'item':
        return <Package size={13} />;
      case 'lore':
      default:
        return <BookMarked size={13} />;
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="story-bible-mention-dropdown"
      style={{ left: `${left}px`, top: `${top}px` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isCreating ? (
        <div className="mention-quick-add">
          <div className="mention-quick-add-title">
            <span>Add to Story Bible</span>
            <button
              type="button"
              className="mention-quick-add-close"
              onClick={() => setIsCreating(false)}
              title="Cancel (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          <input
            ref={nameInputRef}
            type="text"
            className="mention-input"
            placeholder="Name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreateAndInsert();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsCreating(false);
              }
            }}
          />

          <div className="mention-category-pills">
            <button
              type="button"
              className={`mention-category-pill ${newCategory === 'character' ? 'active' : ''}`}
              onClick={() => setNewCategory('character')}
            >
              <User size={12} />
              Character
            </button>
            <button
              type="button"
              className={`mention-category-pill ${newCategory === 'location' ? 'active' : ''}`}
              onClick={() => setNewCategory('location')}
            >
              <MapPin size={12} />
              Location
            </button>
            <button
              type="button"
              className={`mention-category-pill ${newCategory === 'item' ? 'active' : ''}`}
              onClick={() => setNewCategory('item')}
            >
              <Package size={12} />
              Item
            </button>
          </div>

          <input
            type="text"
            className="mention-input"
            placeholder="Brief summary or role (optional)..."
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreateAndInsert();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsCreating(false);
              }
            }}
          />

          <div className="mention-quick-add-actions">
            <button
              type="button"
              className="mention-btn-cancel"
              onClick={() => setIsCreating(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mention-btn-save"
              onClick={() => void handleCreateAndInsert()}
              disabled={!newName.trim()}
            >
              <Check size={12} />
              Save & Insert
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mention-header">
            <div className="mention-header-title">
              <BookOpen size={13} />
              <span>Story Bible</span>
            </div>
            <span className="mention-header-hint">↑↓ navigate · Enter to insert</span>
          </div>

          <div className="mention-list">
            {filteredEntries.length === 0 ? (
              <div className="mention-empty">
                {query ? `No Story Bible entries matching "${query}"` : 'No Story Bible entries yet'}
              </div>
            ) : (
              filteredEntries.map((entry, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`mention-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => insertEntityName(entry.name)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={`mention-item-icon-wrap ${entry.category}`}>
                      {renderCategoryIcon(entry.category)}
                    </div>
                    <div className="mention-item-info">
                      <div className="mention-item-name-row">
                        <span className="mention-item-name">{entry.name}</span>
                        <span className="mention-item-badge">{entry.category}</span>
                      </div>
                      {entry.summary && (
                        <span className="mention-item-summary">{entry.summary}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mention-footer">
            <button
              type="button"
              className={`mention-add-btn ${selectedIndex === filteredEntries.length ? 'selected' : ''}`}
              onClick={() => handleStartCreate(query || undefined)}
              onMouseEnter={() => setSelectedIndex(filteredEntries.length)}
            >
              <Plus size={14} />
              <span>
                {query
                  ? `Add "${query}" to Story Bible...`
                  : 'Add New Character or Location...'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
