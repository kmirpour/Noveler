import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  X,
  Sparkles,
  BarChart2,
  AlertTriangle,
  MessageSquare,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { analyzeProse } from '../../utils/proseAnalysis';
import './ProseAnalysisModal.css';

export function ProseAnalysisModal() {
  const {
    proseAnalysisOpen,
    setProseAnalysisOpen,
    setFindReplaceOpen,
    editorInstance,
    markdownContent,
    fileName,
  } = useEditorStore(
    useShallow((s) => ({
      proseAnalysisOpen: s.proseAnalysisOpen,
      setProseAnalysisOpen: s.setProseAnalysisOpen,
      setFindReplaceOpen: s.setFindReplaceOpen,
      editorInstance: s.editorInstance,
      markdownContent: s.markdownContent,
      fileName: s.fileName,
    }))
  );

  const metrics = useMemo(() => {
    return analyzeProse(markdownContent);
  }, [markdownContent]);

  if (!proseAnalysisOpen) return null;

  const jumpToWordInEditor = (term: string, wholeWord = true) => {
    setProseAnalysisOpen(false);
    setFindReplaceOpen(true);
    if (editorInstance) {
      editorInstance.commands.setCaseSensitive(false);
      editorInstance.commands.setUseRegex(false);
      editorInstance.commands.setWholeWord(wholeWord);
      editorInstance.commands.setSearchTerm(term);
      editorInstance.commands.nextSearchResult();
    }
  };

  const totalS = Math.max(1, metrics.totalSentences);
  const shortPct = Math.round((metrics.shortSentences / totalS) * 100);
  const medPct = Math.round((metrics.mediumSentences / totalS) * 100);
  const longPct = Math.round((metrics.longSentences / totalS) * 100);

  return (
    <div className="modal-backdrop" onClick={() => setProseAnalysisOpen(false)}>
      <div className="prose-analysis-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles className="modal-title-icon" size={20} />
            <h2>Prose Diagnostics — {fileName || 'Active Document'}</h2>
          </div>
          <button
            className="modal-close-btn"
            onClick={() => setProseAnalysisOpen(false)}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="prose-body">
          {/* Top Metric Cards */}
          <div className="metrics-summary-grid">
            <div className="metric-stat-card">
              <span className="stat-label">Reading Ease</span>
              <span className="stat-value">{metrics.fleschReadingEase} / 100</span>
              <span className="stat-hint">{metrics.readabilityLabel}</span>
            </div>

            <div className="metric-stat-card">
              <span className="stat-label">Grade Level</span>
              <span className="stat-value">Grade {metrics.fleschKincaidGrade}</span>
              <span className="stat-hint">Flesch-Kincaid formula</span>
            </div>

            <div className="metric-stat-card">
              <span className="stat-label">Avg Sentence</span>
              <span className="stat-value">{metrics.avgSentenceLength} words</span>
              <span className="stat-hint">
                {metrics.avgSentenceLength < 12
                  ? 'Fast / Punchy'
                  : metrics.avgSentenceLength > 20
                  ? 'Complex / Lyrical'
                  : 'Balanced Pacing'}
              </span>
            </div>

            <div className="metric-stat-card">
              <span className="stat-label">Dialogue Ratio</span>
              <span className="stat-value">{metrics.dialoguePercentage}%</span>
              <span className="stat-hint">{metrics.dialogueWords.toLocaleString()} spoken words</span>
            </div>
          </div>

          {/* Dialogue vs Narrative Pacing */}
          <div className="prose-section">
            <span className="section-title">
              <MessageSquare size={16} />
              Dialogue vs. Narrative Balance
            </span>
            <div className="dialogue-bar-container">
              <div className="dialogue-progress">
                <div
                  className="dialogue-fill"
                  style={{ width: `${metrics.dialoguePercentage}%` }}
                  title={`Dialogue: ${metrics.dialoguePercentage}%`}
                />
                <div
                  className="narrative-fill"
                  style={{ width: `${100 - metrics.dialoguePercentage}%` }}
                  title={`Narrative: ${100 - metrics.dialoguePercentage}%`}
                />
              </div>
              <div className="dialogue-labels">
                <span>💬 Spoken Dialogue: {metrics.dialoguePercentage}% ({metrics.dialogueWords} words)</span>
                <span>📖 Narrative Prose: {100 - metrics.dialoguePercentage}% ({metrics.narrativeWords} words)</span>
              </div>
            </div>
          </div>

          {/* Sentence Rhythm / Pacing */}
          <div className="prose-section">
            <span className="section-title">
              <Activity size={16} />
              Sentence Length Rhythm & Variety
            </span>
            <div className="rhythm-bar-container">
              <div className="rhythm-bar-row">
                <span className="rhythm-type">Short (&lt;10 words)</span>
                <div className="rhythm-bar-bg">
                  <div className="rhythm-bar-fill fill-short" style={{ width: `${shortPct}%` }} />
                </div>
                <span className="rhythm-count">{metrics.shortSentences} ({shortPct}%)</span>
              </div>

              <div className="rhythm-bar-row">
                <span className="rhythm-type">Medium (10–25 words)</span>
                <div className="rhythm-bar-bg">
                  <div className="rhythm-bar-fill fill-medium" style={{ width: `${medPct}%` }} />
                </div>
                <span className="rhythm-count">{metrics.mediumSentences} ({medPct}%)</span>
              </div>

              <div className="rhythm-bar-row">
                <span className="rhythm-type">Long (&gt;25 words)</span>
                <div className="rhythm-bar-bg">
                  <div className="rhythm-bar-fill fill-long" style={{ width: `${longPct}%` }} />
                </div>
                <span className="rhythm-count">{metrics.longSentences} ({longPct}%)</span>
              </div>
            </div>
          </div>

          {/* Diagnostics Grid: Adverbs & Filter words */}
          <div className="diagnostics-grid">
            {/* Adverbs */}
            <div className="diagnostic-panel">
              <span className="section-title">
                <BarChart2 size={15} />
                Adverbs Ending in -ly ({metrics.totalAdverbs})
              </span>
              {metrics.adverbs.length === 0 ? (
                <div className="empty-diagnostic">
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 4 }} />
                  Zero adverbs found! Clean, strong verb usage.
                </div>
              ) : (
                <div className="tag-cloud">
                  {metrics.adverbs.map((item) => (
                    <button
                      type="button"
                      key={item.word}
                      className="prose-tag clickable-prose-tag"
                      onClick={() => jumpToWordInEditor(item.word, true)}
                      title={`Click to highlight "${item.word}" in manuscript`}
                    >
                      <span>{item.word}</span>
                      <span className="count">×{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Words */}
            <div className="diagnostic-panel">
              <span className="section-title">
                <AlertTriangle size={15} />
                Filter / Telling Words ({metrics.totalFilterWords})
              </span>
              {metrics.filterWords.length === 0 ? (
                <div className="empty-diagnostic">
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 4 }} />
                  No perception filter words detected.
                </div>
              ) : (
                <div className="tag-cloud">
                  {metrics.filterWords.map((item) => (
                    <button
                      type="button"
                      key={item.word}
                      className="prose-tag alert clickable-prose-tag"
                      onClick={() => jumpToWordInEditor(item.word, true)}
                      title={`Click to highlight "${item.word}" in manuscript`}
                    >
                      <span>{item.word}</span>
                      <span className="count">×{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Passive Voice & Echoes */}
          <div className="diagnostics-grid">
            {/* Passive Voice */}
            <div className="diagnostic-panel">
              <span className="section-title">
                <AlertTriangle size={15} />
                Passive Voice Candidates ({metrics.passiveVoiceInstances.length})
              </span>
              {metrics.passiveVoiceInstances.length === 0 ? (
                <div className="empty-diagnostic">
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 4 }} />
                  No passive voice constructions detected.
                </div>
              ) : (
                <div className="passive-list">
                  {metrics.passiveVoiceInstances.map((pv, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="passive-item clickable-prose-tag"
                      onClick={() => jumpToWordInEditor(pv, false)}
                      title={`Click to find "${pv}" in manuscript`}
                    >
                      "{pv}"
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Echoes / Repeated Words */}
            <div className="diagnostic-panel">
              <span className="section-title">
                <BarChart2 size={15} />
                Repeated Content Words
              </span>
              {metrics.topRepeatedWords.length === 0 ? (
                <div className="empty-diagnostic">
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 4 }} />
                  Vocabulary is varied with minimal repetition.
                </div>
              ) : (
                <div className="tag-cloud">
                  {metrics.topRepeatedWords.map((item) => (
                    <button
                      type="button"
                      key={item.word}
                      className="prose-tag clickable-prose-tag"
                      onClick={() => jumpToWordInEditor(item.word, true)}
                      title={`Click to highlight "${item.word}" in manuscript`}
                    >
                      <span>{item.word}</span>
                      <span className="count">×{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
