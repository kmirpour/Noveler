import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  FileDown,
  X,
  CheckSquare,
  Square,
  BookOpen,
  FileText,
  Printer,
} from 'lucide-react';
import { flattenScenes } from '../../services/projectService';
import { compileNovel, type CompileOptions } from '../../export/compiler';
import { exportToPdf } from '../../export/pdf';
import { saveBinaryAs, saveFileAs } from '../../services/fileService';
import './CompileModal.css';

export function CompileModal() {
  const {
    novelProject,
    fileName,
    markdownContent,
    setStatusMessage,
    compileModalOpen,
    setCompileModalOpen,
    printAction,
  } = useEditorStore(
    useShallow((s) => ({
      novelProject: s.novelProject,
      fileName: s.fileName,
      markdownContent: s.markdownContent,
      setStatusMessage: s.setStatusMessage,
      compileModalOpen: s.compileModalOpen,
      setCompileModalOpen: s.setCompileModalOpen,
      printAction: s.printAction,
    }))
  );

  const [scope, setScope] = useState<'entire-novel' | 'current-chapter'>('entire-novel');
  const [title, setTitle] = useState(novelProject?.title || '');
  const [author, setAuthor] = useState(novelProject?.author || '');
  const [contactInfo, setContactInfo] = useState('');
  const [format, setFormat] = useState<'shunn-docx' | 'standard-docx' | 'print-pdf' | 'markdown'>('shunn-docx');
  const [typeface, setTypeface] = useState<'Times New Roman' | 'Courier New' | 'Georgia' | 'Garamond'>('Times New Roman');
  const [sceneBreakSymbol, setSceneBreakSymbol] = useState<string>('#');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  // Sync title and selectedPaths when novelProject changes or modal opens
  React.useEffect(() => {
    if (compileModalOpen) {
      if (novelProject) {
        setTitle((t) => t || novelProject.title);
        setAuthor((a) => a || novelProject.author);
        setSelectedPaths((paths) =>
          paths.length === 0 ? flattenScenes(novelProject.binder).map((s) => s.path) : paths
        );
      } else {
        setScope('current-chapter');
        setTitle((t) => t || fileName?.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled Manuscript');
      }
    }
  }, [novelProject, compileModalOpen, fileName]);

  if (!compileModalOpen) return null;

  const allScenes = novelProject ? flattenScenes(novelProject.binder) : [];

  const toggleSelectAll = () => {
    if (selectedPaths.length === allScenes.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(allScenes.map((s) => s.path));
    }
  };

  const toggleScene = (path: string) => {
    if (selectedPaths.includes(path)) {
      setSelectedPaths(selectedPaths.filter((p) => p !== path));
    } else {
      setSelectedPaths([...selectedPaths, path]);
    }
  };

  const handleCompile = async () => {
    // Print / PDF format
    if (format === 'print-pdf') {
      if (scope === 'entire-novel' && novelProject && selectedPaths.length > 0) {
        setIsCompiling(true);
        try {
          const compiled = await compileNovel(novelProject, {
            title: title || novelProject.title,
            author: author || novelProject.author,
            format: 'markdown',
            sceneBreakSymbol,
            selectedPaths,
          });
          setCompileModalOpen(false);
          exportToPdf(compiled.data as string);
        } finally {
          setIsCompiling(false);
        }
        return;
      }
      setCompileModalOpen(false);
      printAction();
      return;
    }

    setIsCompiling(true);
    try {
      if (scope === 'current-chapter' || !novelProject) {
        // Exporting current chapter only
        const chapterTitle = fileName?.replace(/\.(md|markdown|txt)$/i, '') || 'Chapter';
        if (format === 'markdown') {
          const saved = await saveFileAs(markdownContent, `${chapterTitle}.md`);
          if (saved) setStatusMessage(`Exported chapter as ${saved.name}`);
        } else {
          // Export chapter as DOCX
          const { exportToDocx } = await import('../../export/docx');
          const saved = await exportToDocx(markdownContent, `${chapterTitle}.docx`, {
            title: chapterTitle,
            author: author || novelProject?.author,
            fontFamily: typeface,
            doubleSpaced: true,
          });
          if (saved) setStatusMessage(`Exported ${saved.name}`);
        }
        setCompileModalOpen(false);
        return;
      }

      // Exporting entire novel
      if (selectedPaths.length === 0) {
        setStatusMessage('Please select at least one chapter to export');
        return;
      }

      const options: CompileOptions = {
        title: title || novelProject.title,
        author: author || novelProject.author,
        contactInfo,
        format: format === 'markdown' ? 'markdown' : format === 'standard-docx' ? 'standard-docx' : 'shunn-docx',
        fontFamily: typeface,
        sceneBreakSymbol,
        selectedPaths,
      };

      const result = await compileNovel(novelProject, options);

      if (typeof result.data === 'string') {
        const saved = await saveFileAs(result.data, result.fileName);
        if (saved) setStatusMessage(`Compiled manuscript saved as ${saved.name}`);
      } else {
        const saved = await saveBinaryAs(result.data, result.fileName, {
          name: 'Word Document',
          extensions: ['docx'],
        });
        if (saved) setStatusMessage(`Compiled manuscript saved as ${saved.name}`);
      }
      setCompileModalOpen(false);
    } catch (err) {
      console.error('Compilation failed:', err);
      alert(`Export failed: ${err}`);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setCompileModalOpen(false)}>
      <div className="compile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <BookOpen className="modal-title-icon" size={20} />
            <h2>Export Manuscript</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setCompileModalOpen(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="compile-body">
          {/* Scope Selection */}
          {novelProject && (
            <div className="compile-section">
              <label className="compile-label">Scope Selection</label>
              <div className="scope-pills">
                <button
                  type="button"
                  className={`scope-pill ${scope === 'entire-novel' ? 'active' : ''}`}
                  onClick={() => setScope('entire-novel')}
                >
                  Compile Entire Novel
                </button>
                <button
                  type="button"
                  className={`scope-pill ${scope === 'current-chapter' ? 'active' : ''}`}
                  onClick={() => setScope('current-chapter')}
                >
                  Current Chapter Only
                </button>
              </div>
            </div>
          )}

          {/* Format selection */}
          <div className="compile-section">
            <label className="compile-label">Export Format</label>
            <div className="format-options">
              <label className={`format-card ${format === 'shunn-docx' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="compile-format"
                  value="shunn-docx"
                  checked={format === 'shunn-docx'}
                  onChange={() => setFormat('shunn-docx')}
                />
                <div className="format-info">
                  <strong>Microsoft Word (.docx) — Shunn Standard Format</strong>
                  <span>
                    Industry standard for traditional literary agents and publishers. 1-inch margins, double-spaced, 0.5-inch indents, title page.
                  </span>
                </div>
              </label>

              <label className={`format-card ${format === 'standard-docx' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="compile-format"
                  value="standard-docx"
                  checked={format === 'standard-docx'}
                  onChange={() => setFormat('standard-docx')}
                />
                <div className="format-info">
                  <strong>Clean Word Document (.docx)</strong>
                  <span>Reader-friendly formatting with Georgia typography, paragraph indents, and centered scene breaks.</span>
                </div>
              </label>

              <label className={`format-card ${format === 'print-pdf' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="compile-format"
                  value="print-pdf"
                  checked={format === 'print-pdf'}
                  onChange={() => setFormat('print-pdf')}
                />
                <div className="format-info">
                  <strong>Print / PDF</strong>
                  <span>Clean book layout ready to save as a distraction-free PDF or print directly from your desktop.</span>
                </div>
              </label>

              <label className={`format-card ${format === 'markdown' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="compile-format"
                  value="markdown"
                  checked={format === 'markdown'}
                  onChange={() => setFormat('markdown')}
                />
                <div className="format-info">
                  <strong>Clean Markdown (.md)</strong>
                  <span>Concatenates chapters into a clean, portable Markdown document for backup, Pandoc, or GitHub workflows.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Manuscript Details */}
          <div className="compile-section grid-2">
            <div>
              <label className="compile-label">Book Title</label>
              <input
                type="text"
                className="compile-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Novel Title"
              />
            </div>
            <div>
              <label className="compile-label">Author Name</label>
              <input
                type="text"
                className="compile-input"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author Byline"
              />
            </div>
          </div>

          {format === 'shunn-docx' && (
            <div className="compile-section">
              <label className="compile-label">Author Contact Info (for Shunn Title Page)</label>
              <textarea
                className="compile-textarea"
                rows={2}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Address, Phone, Email, Agent representation..."
              />
            </div>
          )}

          {/* Typeface & Scene Break Options */}
          <div className="compile-section grid-2">
            {(format === 'shunn-docx' || format === 'standard-docx') && (
              <div>
                <label className="compile-label">Publishing Typeface</label>
                <select
                  className="compile-input"
                  value={typeface}
                  onChange={(e) => setTypeface(e.target.value as typeof typeface)}
                >
                  <option value="Times New Roman">Times New Roman (Standard)</option>
                  <option value="Courier New">Courier New (Monospace)</option>
                  <option value="Georgia">Georgia (Editorial Serif)</option>
                  <option value="Garamond">Garamond (Book Print)</option>
                </select>
              </div>
            )}
            <div>
              <label className="compile-label">Scene Break Ornament</label>
              <select
                className="compile-input"
                value={sceneBreakSymbol}
                onChange={(e) => setSceneBreakSymbol(e.target.value)}
              >
                <option value="#"># (Shunn Submission Standard)</option>
                <option value="* * *">* * * (Classic Asterisks)</option>
                <option value="✦   ✦   ✦">✦   ✦   ✦ (Decorative Stars)</option>
              </select>
            </div>
          </div>

          {/* Chapter Inclusion Checklist (only when compiling entire novel) */}
          {scope === 'entire-novel' && novelProject && allScenes.length > 0 && (
            <div className="compile-section">
              <div className="checklist-header">
                <label className="compile-label">
                  Included Chapters ({selectedPaths.length} of {allScenes.length})
                </label>
                <button type="button" className="select-all-btn" onClick={toggleSelectAll}>
                  {selectedPaths.length === allScenes.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="scene-checklist">
                {allScenes.map((scene) => {
                  const isSelected = selectedPaths.includes(scene.path);
                  return (
                    <div
                      key={scene.path}
                      className={`checklist-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleScene(scene.path)}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="check-icon checked" />
                      ) : (
                        <Square size={16} className="check-icon" />
                      )}
                      <FileText size={14} className="scene-icon" />
                      <span className="scene-title">{scene.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="compile-footer">
          <button
            type="button"
            className="compile-cancel-btn"
            onClick={() => setCompileModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="compile-submit-btn"
            onClick={handleCompile}
            disabled={Boolean(isCompiling || (scope === 'entire-novel' && novelProject && selectedPaths.length === 0))}
          >
            {format === 'print-pdf' ? <Printer size={15} /> : <FileDown size={15} />}
            <span>
              {isCompiling
                ? 'Exporting...'
                : format === 'print-pdf'
                ? 'Print / Save PDF'
                : 'Export Manuscript'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
