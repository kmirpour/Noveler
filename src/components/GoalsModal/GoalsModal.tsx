import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Target, X, RotateCcw, BookOpen, Clock, FileText, Sparkles, Flame } from 'lucide-react';
import { wordsToday, currentStreak, recentDays } from '../../utils/writingLog';
import { useEditorStore } from '../../stores/editorStore';
import './GoalsModal.css';

export function GoalsModal() {
  const {
    goalsModalOpen,
    setGoalsModalOpen,
    dailyWordGoal,
    setDailyWordGoal,
    sessionWords,
    writingLog,
    resetSessionWords,
    wordCount,
    charCount,
    markdownContent,
    editorInstance,
    novelWordCount,
    projectPath,
  } = useEditorStore(
    useShallow((s) => ({
      goalsModalOpen: s.goalsModalOpen,
      setGoalsModalOpen: s.setGoalsModalOpen,
      dailyWordGoal: s.dailyWordGoal,
      setDailyWordGoal: s.setDailyWordGoal,
      sessionWords: s.sessionWords,
      writingLog: s.writingLog,
      resetSessionWords: s.resetSessionWords,
      wordCount: s.wordCount,
      charCount: s.charCount,
      markdownContent: s.markdownContent,
      editorInstance: s.editorInstance,
      novelWordCount: s.novelWordCount,
      projectPath: s.projectPath,
    }))
  );

  const [customGoal, setCustomGoal] = useState<string>(String(dailyWordGoal));

  if (!goalsModalOpen) return null;

  // Calculate detailed fiction manuscript stats
  const content = editorInstance ? editorInstance.getMarkdown() : markdownContent;
  const charsNoSpaces = content.replace(/\s+/g, '').length;
  const totalNovelWords = projectPath ? (novelWordCount || wordCount) : wordCount;
  // Per GUIDE.md Section 5: standard of 250 words per paperback page & 250 wpm reading pace
  const readingTimeMin = Math.max(1, Math.ceil(totalNovelWords / 250));
  const estimatedPages = Math.max(1, Math.round(totalNovelWords / 250));
  
  // Count scenes by standard Markdown horizontal rules / scene breaks
  const sceneCount = (content.match(/^(?:---|\*\*\*|___)\s*$/gm) || []).length + 1;

  const todayWords = wordsToday(writingLog);
  const streak = currentStreak(writingLog);
  const history = recentDays(writingLog, 14);
  const historyMax = Math.max(dailyWordGoal, ...history.map((d) => d.words), 1);

  const percent = dailyWordGoal > 0 ? Math.min(100, Math.round((todayWords / dailyWordGoal) * 100)) : 0;
  const isGoalReached = dailyWordGoal > 0 && todayWords >= dailyWordGoal;

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customGoal, 10);
    if (!isNaN(val) && val >= 0) {
      setDailyWordGoal(val);
    }
  };

  const presetGoals = [500, 1000, 1667, 2000, 5000]; // 1667 is NaNoWriMo daily pace

  return (
    <div className="modal-backdrop" onClick={() => setGoalsModalOpen(false)}>
      <div className="goals-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Target className="modal-title-icon" size={20} />
            <h2>Writing Goals & Statistics</h2>
          </div>
          <button className="modal-close-btn" onClick={() => setGoalsModalOpen(false)} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Today's Sprint / Session Progress */}
          <div className={`session-goal-card ${isGoalReached ? 'goal-achieved' : ''}`}>
            <div className="goal-card-header">
              <span className="goal-card-title">Today</span>
              {isGoalReached && (
                <span className="goal-achieved-badge">
                  <Sparkles size={13} />
                  Goal Reached!
                </span>
              )}
            </div>

            <div className="goal-counter">
              <span className="goal-current">{todayWords.toLocaleString()}</span>
              <span className="goal-separator">/</span>
              <span className="goal-target">{dailyWordGoal.toLocaleString()} words</span>
            </div>

            {/* Progress Bar */}
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="progress-bar-caption">
              <span>
                {percent}% of daily goal · {sessionWords.toLocaleString()} this sitting
              </span>
              <button
                className="reset-session-btn"
                onClick={resetSessionWords}
                title="Reset the 'this sitting' counter to zero for a new sprint (today's total is kept)"
              >
                <RotateCcw size={12} />
                New Sprint
              </button>
            </div>
          </div>

          {/* Streak & recent days */}
          <div className="writing-history-section">
            <div className="writing-history-header">
              <label className="section-label">Last 14 Days</label>
              <span className="streak-badge" title="Consecutive days with words written">
                <Flame size={13} />
                {streak} {streak === 1 ? 'day' : 'days'} streak
              </span>
            </div>
            <div className="writing-history-bars" role="img" aria-label="Words written per day, last 14 days">
              {history.map((d) => (
                <div
                  key={d.key}
                  className="writing-history-day"
                  title={`${d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.words.toLocaleString()} words`}
                >
                  <div className="writing-history-track">
                    <div
                      className={`writing-history-bar ${dailyWordGoal > 0 && d.words >= dailyWordGoal ? 'met' : ''}`}
                      style={{ height: `${Math.round((d.words / historyMax) * 100)}%` }}
                    />
                  </div>
                  <span className="writing-history-label">{d.date.getDate()}</span>
                </div>
              ))}
            </div>
            {!projectPath && (
              <p className="writing-history-note">Open a novel folder to keep this history between sessions.</p>
            )}
          </div>

          {/* Goal Preset Selector */}
          <div className="goal-preset-section">
            <label className="section-label">Set Daily Target</label>
            <div className="preset-chips">
              {presetGoals.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`preset-chip ${dailyWordGoal === val ? 'active' : ''}`}
                  onClick={() => {
                    setDailyWordGoal(val);
                    setCustomGoal(String(val));
                  }}
                >
                  {val === 1667 ? '1,667 (NaNo)' : `${val.toLocaleString()} w`}
                </button>
              ))}
            </div>

            <form className="custom-goal-form" onSubmit={handleGoalSubmit}>
              <input
                type="number"
                min="0"
                step="50"
                className="custom-goal-input"
                placeholder="Custom goal..."
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
              />
              <button type="submit" className="custom-goal-apply-btn">
                Set
              </button>
            </form>
          </div>

          {/* Manuscript Metrics Grid */}
          <div className="metrics-section">
            <label className="section-label">Manuscript Metrics</label>
            <div className="metrics-grid">
              <div className="metric-box">
                <FileText size={18} className="metric-icon" />
                <div className="metric-data">
                  <span className="metric-value">
                    {projectPath && novelWordCount > 0
                      ? `${novelWordCount.toLocaleString()}`
                      : wordCount.toLocaleString()}
                  </span>
                  <span className="metric-label">
                    {projectPath && novelWordCount > 0 ? 'Novel Total Words' : 'Chapter Words'}
                  </span>
                </div>
              </div>

              <div className="metric-box">
                <BookOpen size={18} className="metric-icon" />
                <div className="metric-data">
                  <span className="metric-value">~{estimatedPages}</span>
                  <span className="metric-label">Book Pages (250w/pg)</span>
                </div>
              </div>

              <div className="metric-box">
                <Clock size={18} className="metric-icon" />
                <div className="metric-data">
                  <span className="metric-value">{readingTimeMin} min</span>
                  <span className="metric-label">Reading Time</span>
                </div>
              </div>

              <div className="metric-box">
                <Sparkles size={18} className="metric-icon" />
                <div className="metric-data">
                  <span className="metric-value">{sceneCount}</span>
                  <span className="metric-label">{sceneCount === 1 ? 'Scene' : 'Scenes'}</span>
                </div>
              </div>

              <div className="metric-box wide">
                <div className="metric-detail-row">
                  <span>Characters (including spaces):</span>
                  <strong>{charCount.toLocaleString()}</strong>
                </div>
                <div className="metric-detail-row">
                  <span>Characters (excluding spaces):</span>
                  <strong>{charsNoSpaces.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
