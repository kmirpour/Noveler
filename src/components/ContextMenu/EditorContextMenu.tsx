import { useEffect, useRef, useState, useLayoutEffect, useMemo } from 'react';
import { fetchThesaurus, applyCasing, type ThesaurusResult } from '../../services/thesaurusService';
import { fetchSpellingSuggestions, sanitizeSpellWord } from '../../services/spellingService';
import { useEditorStore } from '../../stores/editorStore';
import { BookOpen, Scissors, Copy, Clipboard, ChevronRight, Loader2, Check, BookPlus } from 'lucide-react';
import './EditorContextMenu.css';

export interface EditorContextMenuProps {
  x: number;
  y: number;
  targetWord: string;
  hasSelection: boolean;
  onReplaceWord: (replacement: string) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function EditorContextMenu({
  x,
  y,
  targetWord,
  hasSelection,
  onReplaceWord,
  onCut,
  onCopy,
  onPaste,
  onClose,
}: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ top: y, left: x, flipSubmenu: false });
  const [isThesaurusHovered, setIsThesaurusHovered] = useState(false);
  const [thesaurusData, setThesaurusData] = useState<ThesaurusResult | null>(null);
  const [spellingSuggestions, setSpellingSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const novelProject = useEditorStore((s) => s.novelProject);
  const addCustomDictionaryWordAction = useEditorStore((s) => s.addCustomDictionaryWordAction);

  const projectIgnoreWords = useMemo(() => {
    const words = new Set<string>(novelProject?.customDictionary || []);
    for (const entry of novelProject?.codex || []) {
      for (const part of entry.name.split(/\s+/)) {
        const clean = sanitizeSpellWord(part);
        if (clean) words.add(clean.toLowerCase());
      }
      for (const alias of entry.aliases || []) {
        for (const part of alias.split(/\s+/)) {
          const clean = sanitizeSpellWord(part);
          if (clean) words.add(clean.toLowerCase());
        }
      }
    }
    return Array.from(words);
  }, [novelProject]);

  // Position adjustment to avoid viewport overflow
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;
    let flipSubmenu = false;

    // Flip or shift if clipping right
    if (x + rect.width + 190 > viewportWidth) {
      flipSubmenu = true;
      if (x + rect.width > viewportWidth) {
        left = Math.max(10, viewportWidth - rect.width - 10);
      }
    }

    // Shift up if clipping bottom
    if (y + rect.height > viewportHeight) {
      top = Math.max(10, viewportHeight - rect.height - 10);
    }

    setAdjustedPos({ top, left, flipSubmenu });
  }, [x, y]);

  // Pre-fetch thesaurus data when menu opens for snappy response
  useEffect(() => {
    if (!targetWord) return;

    let isMounted = true;
    setIsLoading(true);

    fetchThesaurus(targetWord)
      .then((res) => {
        if (isMounted) {
          setThesaurusData(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    fetchSpellingSuggestions(targetWord, projectIgnoreWords)
      .then((suggestions) => {
        if (isMounted) {
          setSpellingSuggestions(suggestions);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSpellingSuggestions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetWord, projectIgnoreWords]);

  // Click outside and escape key listeners
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  const hasSynonyms = (thesaurusData?.synonyms.length ?? 0) > 0;
  const hasAntonyms = (thesaurusData?.antonyms.length ?? 0) > 0;
  const hasThesaurusResults = hasSynonyms || hasAntonyms;

  const displayWord = targetWord.length > 18 ? targetWord.slice(0, 16) + '…' : targetWord;

  return (
    <div
      ref={menuRef}
      className="editor-context-menu"
      style={{
        top: `${adjustedPos.top}px`,
        left: `${adjustedPos.left}px`,
      }}
      role="menu"
    >
      {/* Spelling Suggestions for Misspelled Words */}
      {spellingSuggestions.length > 0 && (
        <div className="spelling-suggestions-section">
          <div className="spelling-header">
            <Check size={13} className="spelling-header-icon" />
            <span>Spelling Suggestions</span>
          </div>
          {spellingSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="context-menu-item spelling-item"
              onClick={() => {
                onReplaceWord(suggestion);
                onClose();
              }}
            >
              <span className="menu-label spelling-suggestion-label">
                {applyCasing(targetWord, suggestion)}
              </span>
            </button>
          ))}
          {novelProject && targetWord && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void addCustomDictionaryWordAction(sanitizeSpellWord(targetWord));
                onClose();
              }}
            >
              <BookPlus size={13} className="menu-icon" />
              <span className="menu-label">Add "{displayWord}" to Project Dictionary</span>
            </button>
          )}
          <div className="context-menu-divider" />
        </div>
      )}

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onCut();
          onClose();
        }}
        disabled={!hasSelection}
      >
        <Scissors size={14} className="menu-icon" />
        <span className="menu-label">Cut</span>
        <span className="menu-shortcut">Ctrl+X</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onCopy();
          onClose();
        }}
        disabled={!hasSelection}
      >
        <Copy size={14} className="menu-icon" />
        <span className="menu-label">Copy</span>
        <span className="menu-shortcut">Ctrl+C</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onPaste();
          onClose();
        }}
      >
        <Clipboard size={14} className="menu-icon" />
        <span className="menu-label">Paste</span>
        <span className="menu-shortcut">Ctrl+V</span>
      </button>

      <div className="context-menu-divider" />

      {/* Thesaurus Submenu Trigger */}
      <div
        className={`context-menu-item submenu-trigger ${isThesaurusHovered ? 'active' : ''} ${!targetWord ? 'disabled' : ''}`}
        onMouseEnter={() => setIsThesaurusHovered(true)}
        onMouseLeave={() => setIsThesaurusHovered(false)}
        role="menuitem"
        aria-haspopup="true"
      >
        <BookOpen size={14} className="menu-icon" />
        <span className="menu-label">
          Thesaurus {targetWord ? <em className="target-word-pill">"{displayWord}"</em> : ''}
        </span>
        <ChevronRight size={14} className="menu-arrow" />

        {/* Flyout Submenu */}
        {isThesaurusHovered && Boolean(targetWord) && (
          <div className={`thesaurus-flyout ${adjustedPos.flipSubmenu ? 'flip-left' : 'flip-right'}`}>
            {isLoading ? (
              <div className="flyout-status">
                <Loader2 size={13} className="spin-icon" />
                <span>Searching thesaurus…</span>
              </div>
            ) : !hasThesaurusResults ? (
              <div className="flyout-empty">No synonyms or antonyms found for "{displayWord}"</div>
            ) : (
              <>
                {hasSynonyms && (
                  <div className="flyout-section">
                    <div className="flyout-header">Synonyms</div>
                    <div className="flyout-list">
                      {thesaurusData?.synonyms.map((syn) => (
                        <button
                          key={syn}
                          type="button"
                          className="flyout-word-item synonym-item"
                          onClick={() => {
                            onReplaceWord(syn);
                            onClose();
                          }}
                        >
                          {syn}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasSynonyms && hasAntonyms && <div className="flyout-divider" />}

                {hasAntonyms && (
                  <div className="flyout-section">
                    <div className="flyout-header antonym-header">Antonyms</div>
                    <div className="flyout-list">
                      {thesaurusData?.antonyms.map((ant) => (
                        <button
                          key={ant}
                          type="button"
                          className="flyout-word-item antonym-item"
                          onClick={() => {
                            onReplaceWord(ant);
                            onClose();
                          }}
                        >
                          {ant}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
