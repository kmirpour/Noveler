import { describe, expect, it } from 'vitest';
import { analyzeProse, countSyllables } from './proseAnalysis';

describe('countSyllables', () => {
  it('counts syllables accurately for common words', () => {
    expect(countSyllables('the')).toBe(1);
    expect(countSyllables('quick')).toBe(1);
    expect(countSyllables('silent')).toBe(2);
    expect(countSyllables('whispering')).toBe(3);
    expect(countSyllables('mysterious')).toBe(4);
  });
});

describe('analyzeProse', () => {
  it('returns zero metrics for empty text', () => {
    const metrics = analyzeProse('');
    expect(metrics.totalWords).toBe(0);
    expect(metrics.totalSentences).toBe(0);
    expect(metrics.dialogueWords).toBe(0);
    expect(metrics.adverbs).toEqual([]);
  });

  it('detects spoken dialogue vs narrative prose', () => {
    const text = `Elena stood on the windy cliff. "We need to leave," she said softly. "The storm is coming."`;
    const metrics = analyzeProse(text);

    expect(metrics.dialogueWords).toBe(8); // "We need to leave," + "The storm is coming."
    expect(metrics.narrativeWords).toBe(metrics.totalWords - metrics.dialogueWords);
    expect(metrics.dialoguePercentage).toBeGreaterThan(0);
  });

  it('detects adverbs while ignoring adjectives like friendly and only', () => {
    const text = `She quietly walked into the dark room. He was only a friendly stranger who smiled warmly.`;
    const metrics = analyzeProse(text);

    const words = metrics.adverbs.map((a) => a.word);
    expect(words).toContain('quietly');
    expect(words).toContain('warmly');
    expect(words).not.toContain('friendly');
    expect(words).not.toContain('only');
    expect(metrics.totalAdverbs).toBe(2);
  });

  it('detects sensory filter words', () => {
    const text = `She felt the cold wind against her neck. She noticed the door was open, and heard footsteps outside.`;
    const metrics = analyzeProse(text);

    const filterWords = metrics.filterWords.map((f) => f.word);
    expect(filterWords).toContain('felt');
    expect(filterWords).toContain('noticed');
    expect(filterWords).toContain('heard');
    expect(metrics.totalFilterWords).toBe(3);
  });

  it('detects passive voice constructions', () => {
    const text = `The letter was written in blood. The sacred chalice had been stolen from the temple vault.`;
    const metrics = analyzeProse(text);

    expect(metrics.passiveVoiceInstances.length).toBeGreaterThan(0);
    expect(metrics.passiveVoiceInstances).toContain('was written');
    expect(metrics.passiveVoiceInstances).toContain('been stolen');
  });

  it('calculates sentence length rhythm distribution', () => {
    const text = `Stop! Don't move! The heavy iron gate slammed shut with a sharp clang. The ancient, rusted iron door swung open with a dreadful, agonizing screech that echoed relentlessly through every shadowy, forgotten corridor of the subterranean dungeon below the abandoned castle.`;
    const metrics = analyzeProse(text);

    expect(metrics.shortSentences).toBeGreaterThanOrEqual(1); // "Stop!"
    expect(metrics.mediumSentences).toBeGreaterThanOrEqual(1); // Gate sentence
    expect(metrics.longSentences).toBeGreaterThanOrEqual(1); // Corridor sentence (>25 words)
  });

  it('computes Flesch Reading Ease and Grade Level', () => {
    const text = `The cat sat on the mat. The dog ran in the sun. It was a good day.`;
    const metrics = analyzeProse(text);

    expect(metrics.fleschReadingEase).toBeGreaterThan(70);
    expect(metrics.fleschKincaidGrade).toBeLessThan(5);
  });
});
