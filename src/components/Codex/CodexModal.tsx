import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  BookOpen,
  X,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import {
  type CodexEntry,
  type CodexCategory,
  findEntityMentions,
} from '../../services/projectService';
import './CodexModal.css';

export function CodexModal() {
  const {
    novelProject,
    codexModalOpen,
    setCodexModalOpen,
    addCodexEntryAction,
    updateCodexEntryAction,
    deleteCodexEntryAction,
    markdownContent,
  } = useEditorStore(
    useShallow((s) => ({
      novelProject: s.novelProject,
      codexModalOpen: s.codexModalOpen,
      setCodexModalOpen: s.setCodexModalOpen,
      addCodexEntryAction: s.addCodexEntryAction,
      updateCodexEntryAction: s.updateCodexEntryAction,
      deleteCodexEntryAction: s.deleteCodexEntryAction,
      markdownContent: s.markdownContent,
    }))
  );

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CodexCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<CodexCategory>('character');
  const [formAliases, setFormAliases] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isNew, setIsNew] = useState(false);

  const entries: CodexEntry[] = useMemo(() => {
    return novelProject?.codex || [];
  }, [novelProject]);

  const activeSceneMentions = useMemo(() => {
    return findEntityMentions(markdownContent, entries);
  }, [markdownContent, entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
      const matchesSearch =
        search.trim() === '' ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.summary.toLowerCase().includes(search.toLowerCase()) ||
        (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase())));
      return matchesCategory && matchesSearch;
    });
  }, [entries, selectedCategory, search]);

  const selectEntry = (entry: CodexEntry) => {
    setSelectedId(entry.id);
    setFormName(entry.name);
    setFormCategory(entry.category);
    setFormAliases((entry.aliases || []).join(', '));
    setFormSummary(entry.summary || '');
    setFormDescription(entry.description || '');
    setIsNew(false);
  };

  const handleStartNew = () => {
    setSelectedId(null);
    setFormName('');
    setFormCategory(selectedCategory === 'all' ? 'character' : selectedCategory);
    setFormAliases('');
    setFormSummary('');
    setFormDescription('');
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Please enter an entry name.');
      return;
    }

    const aliases = formAliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (isNew) {
      await addCodexEntryAction({
        name: formName.trim(),
        category: formCategory,
        aliases,
        summary: formSummary.trim(),
        description: formDescription.trim(),
      });
      setIsNew(false);
    } else if (selectedId) {
      await updateCodexEntryAction({
        id: selectedId,
        name: formName.trim(),
        category: formCategory,
        aliases,
        summary: formSummary.trim(),
        description: formDescription.trim(),
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (confirm(`Delete "${formName}" from Story Bible?`)) {
      await deleteCodexEntryAction(selectedId);
      setSelectedId(null);
      setIsNew(false);
    }
  };

  if (!codexModalOpen || !novelProject) return null;

  return (
    <div className="modal-backdrop" onClick={() => setCodexModalOpen(false)}>
      <div className="codex-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <BookOpen className="modal-title-icon" size={20} />
            <h2>Story Bible & Codex</h2>
          </div>
          <button
            className="modal-close-btn"
            onClick={() => setCodexModalOpen(false)}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="codex-content">
          {/* Left Sidebar */}
          <div className="codex-sidebar">
            <div className="codex-search-container">
              <input
                type="text"
                className="codex-search-input"
                placeholder="Search entities & lore..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="codex-category-chips">
                {(['all', 'character', 'location', 'item', 'lore'] as const).map((cat) => (
                  <button
                    key={cat}
                    className={`codex-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="codex-list">
              {filteredEntries.length === 0 ? (
                <div className="codex-list-empty">
                  {entries.length === 0
                    ? 'No entries yet. Add your characters, locations, and world lore!'
                    : 'No matching entries found.'}
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected = selectedId === entry.id;
                  const isMentioned = activeSceneMentions.some((m) => m.id === entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={`codex-list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectEntry(entry)}
                    >
                      <div className="codex-item-header">
                        <span className="codex-item-name">{entry.name}</span>
                        <span className={`codex-item-badge badge-${entry.category}`}>
                          {entry.category}
                        </span>
                      </div>
                      {entry.summary && (
                        <div className="codex-item-summary">{entry.summary}</div>
                      )}
                      {isMentioned && (
                        <div>
                          <span className="codex-scene-mentions-tag">In Current Scene</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="codex-sidebar-footer">
              <button className="codex-new-btn" onClick={handleStartNew}>
                <Plus size={14} />
                <span>Add Entry</span>
              </button>
            </div>
          </div>

          {/* Right Main Detail Editor */}
          <div className="codex-main">
            {selectedId || isNew ? (
              <>
                <div className="codex-form-row">
                  <div className="codex-form-group" style={{ flex: 2 }}>
                    <label className="codex-label">Name / Entity</label>
                    <input
                      type="text"
                      className="codex-input"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Elena Vance, The Citadel"
                    />
                  </div>
                  <div className="codex-form-group" style={{ flex: 1 }}>
                    <label className="codex-label">Category</label>
                    <select
                      className="codex-select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as CodexCategory)}
                    >
                      <option value="character">Character</option>
                      <option value="location">Location</option>
                      <option value="item">Item</option>
                      <option value="lore">Lore / Faction</option>
                    </select>
                  </div>
                </div>

                <div className="codex-form-group">
                  <label className="codex-label">Aliases & Nicknames (comma separated)</label>
                  <input
                    type="text"
                    className="codex-input"
                    value={formAliases}
                    onChange={(e) => setFormAliases(e.target.value)}
                    placeholder="e.g. Ellie, The Raven, Commander"
                  />
                </div>

                <div className="codex-form-group">
                  <label className="codex-label">Logline / Short Summary</label>
                  <input
                    type="text"
                    className="codex-input"
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="One-line summary for quick reference"
                  />
                </div>

                <div className="codex-form-group" style={{ flex: 1 }}>
                  <label className="codex-label">Notes & World Details</label>
                  <textarea
                    className="codex-textarea"
                    rows={8}
                    style={{ flex: 1 }}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Physical appearance, voice, motivations, backstory, sensory traits, relationships..."
                  />
                </div>

                <div className="codex-actions">
                  <div>
                    {!isNew && selectedId && (
                      <button className="codex-delete-btn" onClick={handleDelete}>
                        <Trash2 size={13} />
                        <span>Delete Entry</span>
                      </button>
                    )}
                  </div>
                  <button className="codex-save-btn" onClick={handleSave}>
                    <Save size={14} style={{ display: 'inline', marginRight: 6 }} />
                    <span>{isNew ? 'Create Entry' : 'Save Changes'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="codex-main-empty">
                <BookOpen size={36} opacity={0.3} />
                <p>Select an entry from the list or create a new one to view and edit details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
