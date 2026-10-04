import { useState, useMemo } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import {
  extractNarrativeTags,
  categorizeTags,
  findTagPositionInEditor,
  NarrativeTag,
} from '../../utils/narrativeTags';
import { Hash, Plus, Sparkles } from 'lucide-react';
import './TagsTab.css';

export function TagsTab() {
  const {
    markdownContent,
    editorInstance,
    tagCategories,
    tagAssignments,
    addTagCategoryAction,
    assignTagCategoryAction,
  } = useEditorStore();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Extract all narrative tags in real time from the current active chapter
  const extractedTags = useMemo(() => {
    return extractNarrativeTags(markdownContent);
  }, [markdownContent]);

  const categories = useMemo(() => {
    return tagCategories || ['characters', 'locations', 'items', 'scenes'];
  }, [tagCategories]);

  const categorized = useMemo(() => {
    return categorizeTags(extractedTags, categories, tagAssignments || {});
  }, [extractedTags, categories, tagAssignments]);

  const handleTagClick = (tagName: string) => {
    if (!editorInstance) return;
    const pos = findTagPositionInEditor(editorInstance.state.doc, tagName);
    if (pos) {
      editorInstance
        .chain()
        .focus()
        .setTextSelection({ from: pos.from, to: pos.to })
        .scrollIntoView()
        .run();
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim().toLowerCase().replace(/^#/, '');
    if (name) {
      await addTagCategoryAction(name);
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const visibleTags: NarrativeTag[] = useMemo(() => {
    if (!activeCategoryFilter) {
      return extractedTags;
    }
    return categorized[activeCategoryFilter] || [];
  }, [activeCategoryFilter, extractedTags, categorized]);

  return (
    <div className="tags-panel">
      {/* Category Pills Header */}
      <div className="tags-categories-bar">
        <button
          className={`category-pill ${activeCategoryFilter === null ? 'active' : ''}`}
          onClick={() => setActiveCategoryFilter(null)}
          title="All Tags"
        >
          All ({extractedTags.length})
        </button>
        {categories.map((cat) => {
          const count = (categorized[cat] || []).length;
          return (
            <button
              key={cat}
              className={`category-pill ${activeCategoryFilter === cat ? 'active' : ''}`}
              onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat ? null : cat)}
              title={`Filter by #${cat}`}
            >
              #{cat} ({count})
            </button>
          );
        })}
        <button
          className="add-category-btn"
          onClick={() => setIsAddingCategory(!isAddingCategory)}
          title="Add Tag Category"
        >
          <Plus size={12} />
        </button>
      </div>

      {isAddingCategory && (
        <form className="add-category-form" onSubmit={handleAddCategorySubmit}>
          <input
            type="text"
            autoFocus
            className="add-category-input"
            placeholder="Category name (e.g. items)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button type="submit" className="add-category-submit">
            Add
          </button>
          <button
            type="button"
            className="add-category-cancel"
            onClick={() => setIsAddingCategory(false)}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Narrative Tag Cloud */}
      <div className="tags-content">
        {extractedTags.length === 0 ? (
          <div className="tags-empty-state">
            <Sparkles size={24} className="tags-empty-icon" />
            <h4>No Narrative Tags Found</h4>
            <p>
              Write hashtags directly in your text (e.g.{' '}
              <code>#alice</code>, <code>#the-docks</code>, <code>#brass-key</code>) to track characters, locations, and items.
            </p>
          </div>
        ) : (
          <div className="tags-cloud">
            {visibleTags.map((tag) => {
              const currentCat = tagAssignments?.[tag.name] || 'uncategorized';
              return (
                <div key={tag.name} className="tag-pill-wrapper">
                  <button
                    className="tag-pill"
                    onClick={() => handleTagClick(tag.name)}
                    title={`Click to jump to #${tag.name} in editor (${tag.count} mention${tag.count > 1 ? 's' : ''})`}
                  >
                    <Hash size={11} className="tag-hash-icon" />
                    <span className="tag-label">{tag.name}</span>
                    <span className="tag-count">{tag.count}</span>
                  </button>

                  <select
                    className="tag-category-select"
                    value={currentCat}
                    onChange={(e) => void assignTagCategoryAction(tag.name, e.target.value)}
                    title={`Categorize #${tag.name}`}
                  >
                    <option value="uncategorized">—</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        #{c}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
