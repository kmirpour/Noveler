import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import {
  FileDown,
  X,
  CheckSquare,
  Square,
  BookOpen,
  FileText,
} from 'lucide-react';
import { flattenScenes } from '../../services/projectService';
import { compileNovel, type CompileOptions } from '../../export/compiler';
import { saveBinaryAs, saveFileAs } from '../../services/fileService';
import './CompileModal.css';

export function CompileModal() {
  const {
    novelProject,
    setStatusMessage,
    compileModalOpen,
    setCompileModalOpen,
  } = useEditorStore();

  const [title, setTitle] = useState(novelProject?.title || '');
  const [author, setAuthor] = useState(novelProject?.author || '');
  const [contactInfo, setContactInfo] = useState('');
  const [format, setFormat] = useState<'shunn-docx' | 'standard-docx' | 'markdown'>('shunn-docx');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  // Sync title and selectedPaths when novelProject changes or modal opens
  React.useEffect(() => {
    if (novelProject && compileModalOpen) {
      setTitle((t) => t || novelProject.title);
      setAuthor((a) => a || novelProject.author);
      setSelectedPaths((paths) =>
        paths.length === 0 ? flattenScenes(novelProject.binder).map((s) => s.path) : paths
      );
    }
  }, [novelProject, compileModalOpen]);

  if (!compileModalOpen || !novelProject) return null;

  const allScenes = flattenScenes(novelProject.binder);

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
    if (selectedPaths.length === 0) {
      alert('Please select at least one scene to compile.');
      return;
    }

    setIsCompiling(true);
    try {
      const options: CompileOptions = {
        title: title || novelProject.title,
        author: author || novelProject.author,
        contactInfo,
        format,
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
      alert(`Compilation failed: ${err}`);
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
            <h2>Compile Manuscript</h2>
          </div>
          <button className="modal-close-btn" onClick={() => setCompileModalOpen(false)} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="compile-body">
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
                  <strong>Standard Manuscript (Shunn DOCX)</strong>
                  <span>Industry-standard submission format for publishers, agents & editors. Title page, headers, Courier/Times double-spaced.</span>
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
                  <span>Reader-friendly formatting with Georgia typography, indented paragraphs, and centered scene breaks.</span>
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
                  <strong>Single Markdown File (.md)</strong>
                  <span>Concatenates all scenes into a clean, unified Markdown document for backup, pandoc, or git.</span>
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
              <label className="compile-label">Author Contact Info (for Title Page)</label>
              <textarea
                className="compile-textarea"
                rows={2}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Address, Phone, Email, Agent..."
              />
            </div>
          )}

          {/* Scene Inclusion Checklist */}
          <div className="compile-section">
            <div className="checklist-header">
              <label className="compile-label">Included Scenes ({selectedPaths.length} of {allScenes.length})</label>
              <button className="select-all-btn" onClick={toggleSelectAll}>
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
        </div>

        <div className="compile-footer">
          <button className="compile-cancel-btn" onClick={() => setCompileModalOpen(false)}>
            Cancel
          </button>
          <button
            className="compile-submit-btn"
            onClick={handleCompile}
            disabled={isCompiling || selectedPaths.length === 0}
          >
            <FileDown size={15} />
            <span>{isCompiling ? 'Compiling...' : 'Compile & Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
