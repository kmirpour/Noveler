import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  WholeWord,
  Regex,
  Replace as ReplaceIcon,
  ChevronRight,
  FolderSearch,
  FileText,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { searchPluginKey } from '../../extensions/searchAndReplace';
import { flattenScenes } from '../../services/projectService';
import * as fileService from '../../services/fileService';
import './FindReplace.css';

interface ProjectSearchMatch {
  scenePath: string;
  sceneTitle: string;
  count: number;
  snippet: string;
}

function buildSearchRegExp(
  searchTerm: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  useRegex: boolean
): RegExp | null {
  if (!searchTerm || searchTerm.trim() === '') return null;
  try {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let source = useRegex ? searchTerm : escaped;
    if (wholeWord) source = `\\b${source}\\b`;
    return new RegExp(source, caseSensitive ? 'gu' : 'giu');
  } catch {
    return null;
  }
}

export function FindReplace() {
  const {
    editorInstance,
    findReplaceOpen,
    setFindReplaceOpen,
    novelProject,
    filePath,
    loadSceneByPath,
    refreshProjectFiles,
    setStatusMessage,
  } = useEditorStore(
    useShallow((s) => ({
      editorInstance: s.editorInstance,
      findReplaceOpen: s.findReplaceOpen,
      setFindReplaceOpen: s.setFindReplaceOpen,
      novelProject: s.novelProject,
      filePath: s.filePath,
      loadSceneByPath: s.loadSceneByPath,
      refreshProjectFiles: s.refreshProjectFiles,
      setStatusMessage: s.setStatusMessage,
    }))
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [projectScope, setProjectScope] = useState(false);
  const [projectMatches, setProjectMatches] = useState<ProjectSearchMatch[]>([]);

  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasNavigatedRef = useRef(false);

  // Center the current matched occurrence smoothly in the editor container
  const scrollToMatch = useCallback(() => {
    if (!editorInstance) return;
    requestAnimationFrame(() => {
      const matchElem = editorInstance.view.dom.querySelector('.search-match-current');
      if (matchElem) {
        matchElem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else {
        const { from } = editorInstance.state.selection;
        const coords = editorInstance.view.coordsAtPos(from);
        const container = editorInstance.view.dom.closest('.editor-container');
        if (coords && container) {
          const containerRect = container.getBoundingClientRect();
          const targetTop = coords.top - containerRect.top + container.scrollTop - container.clientHeight / 2;
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
      }
    });
  }, [editorInstance]);

  // Sync state from editor search plugin
  const syncFromEditor = useCallback(() => {
    if (!editorInstance) return;
    const pluginState = searchPluginKey.getState(editorInstance.state);
    if (pluginState) {
      setMatchCount(pluginState.results.length);
      setCurrentIndex(pluginState.currentIndex);
    }
  }, [editorInstance]);

  // Run project-wide search across all chapters when projectScope is active
  const runProjectSearch = useCallback(
    async (term: string, cs: boolean, ww: boolean, rx: boolean) => {
      if (!novelProject) {
        setProjectMatches([]);
        return;
      }
      const regex = buildSearchRegExp(term, cs, ww, rx);
      if (!regex) {
        setProjectMatches([]);
        return;
      }
      const scenes = flattenScenes(novelProject.binder);
      const matches: ProjectSearchMatch[] = [];
      for (const scene of scenes) {
        try {
          const content =
            scene.path === filePath && editorInstance
              ? editorInstance.getMarkdown()
              : (await fileService.readFileDirect(scene.path)).content;
          const found = content.match(regex);
          if (found && found.length > 0) {
            regex.lastIndex = 0;
            const firstMatch = regex.exec(content);
            let snippet = '';
            if (firstMatch) {
              const start = Math.max(0, firstMatch.index - 25);
              const end = Math.min(content.length, firstMatch.index + firstMatch[0].length + 35);
              snippet =
                (start > 0 ? '…' : '') +
                content.slice(start, end).replace(/\s+/g, ' ').trim() +
                (end < content.length ? '…' : '');
            }
            matches.push({
              scenePath: scene.path,
              sceneTitle: scene.title,
              count: found.length,
              snippet,
            });
          }
        } catch {
          // ignore unreadable files
        }
      }
      setProjectMatches(matches);
    },
    [novelProject, filePath, editorInstance]
  );

  useEffect(() => {
    if (findReplaceOpen && projectScope) {
      void runProjectSearch(searchTerm, caseSensitive, wholeWord, useRegex);
    }
  }, [findReplaceOpen, projectScope, searchTerm, caseSensitive, wholeWord, useRegex, runProjectSearch]);

  // Focus input when opened
  useEffect(() => {
    if (findReplaceOpen) {
      hasNavigatedRef.current = false;
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
      syncFromEditor();
    } else if (editorInstance) {
      editorInstance.commands.clearSearch();
      setMatchCount(0);
      hasNavigatedRef.current = false;
    }
  }, [findReplaceOpen, editorInstance, syncFromEditor]);

  // Update search terms in editor
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    hasNavigatedRef.current = false;
    if (!editorInstance) return;
    editorInstance.commands.setSearchTerm(term);
    setTimeout(syncFromEditor, 10);
  };

  const handleCaseChange = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    hasNavigatedRef.current = false;
    if (!editorInstance) return;
    editorInstance.commands.setCaseSensitive(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleWholeWordChange = () => {
    const next = !wholeWord;
    setWholeWord(next);
    hasNavigatedRef.current = false;
    if (!editorInstance) return;
    editorInstance.commands.setWholeWord(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleRegexChange = () => {
    const next = !useRegex;
    setUseRegex(next);
    hasNavigatedRef.current = false;
    if (!editorInstance) return;
    editorInstance.commands.setUseRegex(next);
    setTimeout(syncFromEditor, 10);
  };

  const handleNext = () => {
    if (!editorInstance) return;
    if (!hasNavigatedRef.current) {
      editorInstance.commands.goToSearchResult(0);
      hasNavigatedRef.current = true;
    } else {
      editorInstance.commands.nextSearchResult();
    }
    syncFromEditor();
    scrollToMatch();
  };

  const handlePrev = () => {
    if (!editorInstance) return;
    hasNavigatedRef.current = true;
    editorInstance.commands.previousSearchResult();
    syncFromEditor();
    scrollToMatch();
  };

  const handleReplaceCurrent = () => {
    if (!editorInstance) return;
    editorInstance.commands.setReplaceTerm(replaceTerm);
    editorInstance.commands.replaceCurrentResult();
    setTimeout(syncFromEditor, 10);
  };

  const handleReplaceAll = async () => {
    if (projectScope && novelProject) {
      const regex = buildSearchRegExp(searchTerm, caseSensitive, wholeWord, useRegex);
      if (!regex) return;
      const totalAcrossProject = projectMatches.reduce((acc, m) => acc + m.count, 0);
      if (totalAcrossProject === 0) return;

      let replacedFiles = 0;
      for (const m of projectMatches) {
        try {
          if (m.scenePath === filePath && editorInstance) {
            editorInstance.commands.setReplaceTerm(replaceTerm);
            editorInstance.commands.replaceAllResults();
            await useEditorStore.getState().saveFileAction();
          } else {
            const f = await fileService.readFileDirect(m.scenePath);
            const updated = f.content.replace(regex, replaceTerm);
            await fileService.saveFile(m.scenePath, updated);
          }
          replacedFiles++;
        } catch {
          // ignore error
        }
      }
      await refreshProjectFiles();
      setTimeout(syncFromEditor, 10);
      void runProjectSearch(searchTerm, caseSensitive, wholeWord, useRegex);
      setStatusMessage(`Replaced ${totalAcrossProject} occurrences across ${replacedFiles} chapters`);
      return;
    }

    if (!editorInstance) return;
    editorInstance.commands.setReplaceTerm(replaceTerm);
    editorInstance.commands.replaceAllResults();
    setTimeout(syncFromEditor, 10);
  };

  const handleClose = () => {
    setFindReplaceOpen(false);
    hasNavigatedRef.current = false;
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
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleNext();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handlePrev();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handlePrev();
                } else {
                  handleNext();
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
              }
            }}
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
          {novelProject && (
            <button
              className={`find-icon-btn ${projectScope ? 'active' : ''}`}
              onClick={() => setProjectScope(!projectScope)}
              title="Search & Replace Across Entire Novel Project"
            >
              <FolderSearch size={16} />
            </button>
          )}
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
              onClick={() => void handleReplaceAll()}
              disabled={projectScope ? projectMatches.length === 0 : matchCount === 0}
              title={projectScope ? 'Replace all matches across every chapter in the novel' : 'Replace all matches in chapter'}
            >
              {projectScope ? 'Replace All in Novel' : 'Replace All'}
            </button>
          </div>
        </div>
      )}

      {projectScope && searchTerm.trim() !== '' && (
        <div className="project-search-results">
          <div className="project-search-header">
            <span>
              Novel Matches:{' '}
              <strong>{projectMatches.reduce((acc, m) => acc + m.count, 0)}</strong> in{' '}
              {projectMatches.length} {projectMatches.length === 1 ? 'chapter' : 'chapters'}
            </span>
          </div>
          {projectMatches.length > 0 && (
            <div className="project-search-list">
              {projectMatches.map((m) => (
                <button
                  key={m.scenePath}
                  type="button"
                  className={`project-search-item ${m.scenePath === filePath ? 'active' : ''}`}
                  onClick={async () => {
                    await loadSceneByPath(m.scenePath);
                    if (editorInstance) {
                      editorInstance.commands.setSearchTerm(searchTerm);
                      setTimeout(syncFromEditor, 20);
                    }
                  }}
                >
                  <div className="project-search-item-top">
                    <FileText size={12} />
                    <span className="project-search-title">{m.sceneTitle}</span>
                    <span className="project-search-badge">{m.count}</span>
                  </div>
                  {m.snippet && <div className="project-search-snippet">{m.snippet}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
