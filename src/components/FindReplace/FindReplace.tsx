import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  WholeWord,
  Regex,
  Replace as ReplaceIcon,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { searchPluginKey } from '../../extensions/searchAndReplace';
import './FindReplace.css';

export function FindReplace() {
  const { editorInstance, findReplaceOpen, setFindReplaceOpen } = useEditorStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state from editor search plugin
  const syncFromEditor = useCallback(() => {
    if (!editorInstance) return;
    const pluginState = searchPluginKey.getState(editorInstance.state);
    if (pluginState) {
      setMatchCount(pluginState.results.length);
      setCurrentIndex(pluginState.currentIndex);
    }
  }, [editorInstance]);

  // Focus input when opened
  useEffect(() => {
    if (findReplaceOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
      syncFromEditor();
    } else if (editorInstance) {
      editorInstance.commands.clearSearch();
      setMatchCount(0);
    }
  }, [findReplaceOpen, editorInstance, syncFromEditor]);

  // Update search terms in editor
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    if (!editorInstance) return;
    editorInstance.commands.setSearchTerm(term);
    setTimeout(syncFromEditor, 10);
  };

  const handleCaseChange = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    if (!editorInstance) return;
    editorInstance.commands.setCaseSensitive(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleWholeWordChange = () => {
    const next = !wholeWord;
    setWholeWord(next);
    if (!editorInstance) return;
    editorInstance.commands.setWholeWord(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleRegexChange = () => {
    const next = !useRegex;
    setUseRegex(next);
    if (!editorInstance) return;
    editorInstance.commands.setUseRegex(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleNext = () => {
    if (!editorInstance) return;
    editorInstance.commands.nextSearchResult();
    syncFromEditor();
  };

  const handlePrev = () => {
    if (!editorInstance) return;
    editorInstance.commands.previousSearchResult();
    syncFromEditor();
  };

  const handleReplaceCurrent = () => {
    if (!editorInstance) return;
    editorInstance.commands.setReplaceTerm(replaceTerm);
    editorInstance.commands.replaceCurrentResult();
    setTimeout(syncFromEditor, 10);
  };

  const handleReplaceAll = () => {
    if (!editorInstance) return;
    editorInstance.commands.setReplaceTerm(replaceTerm);
    editorInstance.commands.replaceAllResults();
    setTimeout(syncFromEditor, 10);
  };

  const handleClose = () => {
    setFindReplaceOpen(false);
    editorInstance?.commands.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  if (!findReplaceOpen) return null;

  return (
    <div className="find-replace-panel" onKeyDown={handleKeyDown}>
      <div className="find-replace-row">
        <button
          className="find-replace-toggle-btn"
          onClick={() => setShowReplace(!showReplace)}
          title={showReplace ? 'Hide Replace' : 'Show Replace'}
        >
          {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="find-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            className="find-replace-input"
            placeholder="Find in manuscript..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <span className="find-match-count">
            {searchTerm.trim() === ''
              ? ''
              : matchCount === 0
              ? 'No results'
              : `${currentIndex + 1} of ${matchCount}`}
          </span>
        </div>

        <div className="find-toggles">
          <button
            className={`find-icon-btn ${caseSensitive ? 'active' : ''}`}
            onClick={handleCaseChange}
            title="Match Case (Alt+C)"
          >
            <CaseSensitive size={16} />
          </button>
          <button
            className={`find-icon-btn ${wholeWord ? 'active' : ''}`}
            onClick={handleWholeWordChange}
            title="Whole Word (Alt+W)"
          >
            <WholeWord size={16} />
          </button>
          <button
            className={`find-icon-btn ${useRegex ? 'active' : ''}`}
            onClick={handleRegexChange}
            title="Use Regular Expression (Alt+R)"
          >
            <Regex size={16} />
          </button>
        </div>

        <div className="find-nav">
          <button
            className="find-icon-btn"
            onClick={handlePrev}
            disabled={matchCount === 0}
            title="Previous Match (Shift+Enter)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="find-icon-btn"
            onClick={handleNext}
            disabled={matchCount === 0}
            title="Next Match (Enter)"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        <button className="find-icon-btn close-btn" onClick={handleClose} title="Close (Escape)">
          <X size={16} />
        </button>
      </div>

      {showReplace && (
        <div className="find-replace-row replace-row">
          <div className="find-replace-spacer" />
          <div className="find-input-wrapper">
            <input
              type="text"
              className="find-replace-input"
              placeholder="Replace with..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.altKey) {
                    handleReplaceAll();
                  } else {
                    handleReplaceCurrent();
                  }
                }
              }}
            />
          </div>

          <div className="replace-actions">
            <button
              className="find-text-btn"
              onClick={handleReplaceCurrent}
              disabled={matchCount === 0}
              title="Replace current match"
            >
              <ReplaceIcon size={14} />
              Replace
            </button>
            <button
              className="find-text-btn"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title="Replace all matches across manuscript"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
