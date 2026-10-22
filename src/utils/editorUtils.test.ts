import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { getWordRangeAtPos } from './editorUtils';

describe('editorUtils.getWordRangeAtPos', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*' },
      text: { inline: true },
    },
  });

  it('detects a word when cursor is inside the word', () => {
    // Document: <p>The quick brown fox</p>
    // Positions:
    // 0: start of doc
    // 1: start of paragraph
    // 1 + 0 = 1: 'T'
    // 1 + 4 = 5: 'q'
    // 1 + 6 = 7: 'i'
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('The quick brown fox')]),
    ]);

    const result = getWordRangeAtPos(doc, 7); // inside 'quick'
    expect(result).not.toBeNull();
    expect(result?.word).toBe('quick');
    expect(result?.from).toBe(5);
    expect(result?.to).toBe(10);
  });

  it('strips punctuation around the word and matches clean boundaries', () => {
    // Document: <p>“Brilliant!” said Alice.</p>
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('“Brilliant!” said Alice.')]),
    ]);

    // Position inside Brilliant
    const result = getWordRangeAtPos(doc, 5);
    expect(result).not.toBeNull();
    expect(result?.word).toBe('Brilliant');
  });

  it('handles hyphenated words and contractions', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text("They didn't look worn-out.")]),
    ]);

    const didntResult = getWordRangeAtPos(doc, 9);
    expect(didntResult?.word).toBe("didn't");

    const wornResult = getWordRangeAtPos(doc, 22);
    expect(wornResult?.word).toBe('worn-out');
  });

  it('returns null when clicking on whitespace or outside text', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Hello world')]),
    ]);

    // Position 6 is the space between 'Hello' and 'world'
    const result = getWordRangeAtPos(doc, 6);
    expect(result).toBeNull();
  });

  it('detects word when cursor is at the first letter of the word', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('The quick fox')]),
    ]);

    // Pos 5 is 'q' (offset 4)
    const result = getWordRangeAtPos(doc, 5);
    expect(result?.word).toBe('quick');
  });

  it('returns null on empty document or invalid positions', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph')]);
    expect(getWordRangeAtPos(doc, 1)).toBeNull();
    expect(getWordRangeAtPos(doc, -1)).toBeNull();
    expect(getWordRangeAtPos(doc, 999)).toBeNull();
  });
});
