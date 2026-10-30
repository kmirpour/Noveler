import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  SpellAndGrammar,
  spellAndGrammarPluginKey,
  type DocumentSpellIssue,
} from './spellAndGrammar';

function createSpellEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit,
      SpellAndGrammar.configure({
        isEnabled: () => true,
        getIgnoreWords: () => [],
      }),
    ],
    content: `<p>${content}</p>`,
  });
}

describe('SpellAndGrammar extension', () => {
  it('preserves existing issues across keystrokes when docChanged occurs', () => {
    const editor = createSpellEditor('This is a test paragraph with errors.');

    const initialIssue: DocumentSpellIssue = {
      from: 11,
      to: 15,
      offset: 0,
      length: 4,
      matchedText: 'test',
      category: 'spelling',
      message: 'Test issue',
      shortMessage: 'Typo',
      replacements: ['best'],
    };

    // Set an issue manually
    editor.view.dispatch(
      editor.state.tr.setMeta(spellAndGrammarPluginKey, [initialIssue])
    );

    let state = spellAndGrammarPluginKey.getState(editor.state);
    expect(state?.issues).toHaveLength(1);
    expect(state?.issues[0].matchedText).toBe('test');

    // Type a character at the end of the paragraph (away from the issue)
    editor.commands.insertContentAt(editor.state.doc.nodeSize - 2, ' More text.');

    state = spellAndGrammarPluginKey.getState(editor.state);
    // The issue must NOT disappear!
    expect(state?.issues).toHaveLength(1);
    expect(state?.issues[0].matchedText).toBe('test');
    expect(state?.issues[0].from).toBe(11);

    editor.destroy();
  });

  it('removes only the edited/corrected issue when a correction is made', () => {
    const editor = createSpellEditor('First error teh and second error adn here.');

    const issue1: DocumentSpellIssue = {
      from: 13,
      to: 16,
      offset: 0,
      length: 3,
      matchedText: 'teh',
      category: 'spelling',
      message: 'Typo',
      shortMessage: 'Typo',
      replacements: ['the'],
    };

    const issue2: DocumentSpellIssue = {
      from: 34,
      to: 37,
      offset: 0,
      length: 3,
      matchedText: 'adn',
      category: 'spelling',
      message: 'Typo',
      shortMessage: 'Typo',
      replacements: ['and'],
    };

    editor.view.dispatch(
      editor.state.tr.setMeta(spellAndGrammarPluginKey, [issue1, issue2])
    );

    let state = spellAndGrammarPluginKey.getState(editor.state);
    expect(state?.issues).toHaveLength(2);

    // Correct the first error "teh" -> "the"
    editor.commands.insertContentAt({ from: 13, to: 16 }, 'the');

    state = spellAndGrammarPluginKey.getState(editor.state);
    // "teh" should be gone, but "adn" should remain!
    expect(state?.issues.some((i) => i.matchedText === 'teh')).toBe(false);
    expect(state?.issues.some((i) => i.matchedText === 'adn')).toBe(true);

    editor.destroy();
  });

  it('updates only the targeted block when block-level meta is received', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        SpellAndGrammar.configure({
          isEnabled: () => true,
          getIgnoreWords: () => [],
        }),
      ],
      content: '<p>Paragraph 1 with error1.</p><p>Paragraph 2 with error2.</p>',
    });

    const issue1: DocumentSpellIssue = {
      from: 18,
      to: 24,
      offset: 0,
      length: 6,
      matchedText: 'error1',
      category: 'spelling',
      message: 'Typo 1',
      shortMessage: 'Typo',
      replacements: [],
    };

    editor.view.dispatch(
      editor.state.tr.setMeta(spellAndGrammarPluginKey, [issue1])
    );

    // Dispatch block update for paragraph 2 (around pos 28 to 55)
    const issue2: DocumentSpellIssue = {
      from: 47,
      to: 53,
      offset: 0,
      length: 6,
      matchedText: 'error2',
      category: 'spelling',
      message: 'Typo 2',
      shortMessage: 'Typo',
      replacements: [],
    };

    editor.view.dispatch(
      editor.state.tr.setMeta(spellAndGrammarPluginKey, {
        blockFrom: 28,
        blockTo: 56,
        issues: [issue2],
      })
    );

    const state = spellAndGrammarPluginKey.getState(editor.state);
    // Both issue1 (from paragraph 1) and issue2 (from paragraph 2) must exist!
    expect(state?.issues).toHaveLength(2);
    expect(state?.issues.map((i) => i.matchedText)).toEqual(['error1', 'error2']);

    editor.destroy();
  });
});
