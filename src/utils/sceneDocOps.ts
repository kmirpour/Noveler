import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';

/**
 * Scene operations applied directly to the live editor document.
 *
 * A scene is a top-level `##` heading plus every block up to the next one. Editing the document
 * through transactions (instead of replacing the whole text) keeps each operation a single,
 * precise undo step and leaves the cursor where it was.
 */

export interface SceneRange {
  /** Position of the `##` heading node. */
  from: number;
  /** End of the scene: start of the next `##` heading, or the end of the document. */
  to: number;
  headingSize: number;
}

export function getSceneRanges(doc: ProseMirrorNode): SceneRange[] {
  const starts: { from: number; headingSize: number }[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      starts.push({ from: offset, headingSize: node.nodeSize });
    }
  });
  return starts.map((s, i) => ({
    from: s.from,
    to: i + 1 < starts.length ? starts[i + 1].from : doc.content.size,
    headingSize: s.headingSize,
  }));
}

/**
 * Drops the undo history. Called after a different file is loaded into the editor, so that
 * Ctrl+Z can never bring the previous chapter's text back into the newly opened one.
 */
export function resetEditorHistory(editor: Editor): void {
  try {
    const { state, view } = editor;
    view.updateState(
      EditorState.create({ schema: state.schema, doc: state.doc, plugins: state.plugins })
    );
  } catch (err) {
    console.warn('Could not reset undo history:', err);
  }
}

/** Sets the chapter's `# Title`: rewrites the first level-1 heading, or adds one at the top. */
export function setChapterTitleInEditor(editor: Editor, title: string): boolean {
  const clean = title.trim();
  if (!clean) return false;
  const { state, view } = editor;

  let found: { from: number; size: number } | null = null;
  state.doc.forEach((node, offset) => {
    if (!found && node.type.name === 'heading' && node.attrs.level === 1) {
      found = { from: offset, size: node.nodeSize };
    }
  });

  if (found) {
    const { from, size } = found as { from: number; size: number };
    if (state.doc.textBetween(from, from + size, ' ') === clean) return false;
    view.dispatch(state.tr.insertText(clean, from + 1, from + size - 1));
  } else {
    const heading = state.schema.nodes.heading.create({ level: 1 }, state.schema.text(clean));
    view.dispatch(state.tr.insert(0, heading));
  }
  return true;
}

export function renameSceneInEditor(editor: Editor, sceneIndex: number, newTitle: string): boolean {
  const { state, view } = editor;
  const range = getSceneRanges(state.doc)[sceneIndex];
  if (!range) return false;

  const title = newTitle.trim() || `Scene ${sceneIndex + 1}`;
  const current = state.doc.textBetween(range.from, range.from + range.headingSize, ' ');
  if (current === title) return false;

  view.dispatch(state.tr.insertText(title, range.from + 1, range.from + range.headingSize - 1));
  return true;
}

/**
 * Moves a scene so that it ends up at `toIndex`, matching Array.splice semantics
 * (remove at `fromIndex`, insert at `toIndex` in the remaining list).
 */
export function moveSceneInEditor(editor: Editor, fromIndex: number, toIndex: number): boolean {
  const { state, view } = editor;
  const ranges = getSceneRanges(state.doc);
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ranges.length ||
    toIndex >= ranges.length
  ) {
    return false;
  }

  const moved = ranges[fromIndex];
  const remaining = ranges.filter((_, i) => i !== fromIndex);
  const insertAt = toIndex < remaining.length ? remaining[toIndex].from : state.doc.content.size;

  const content = state.doc.slice(moved.from, moved.to).content;
  const tr = state.tr.delete(moved.from, moved.to);
  tr.insert(tr.mapping.map(insertAt), content);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Inserts an empty `## title` scene after `afterIndex` (use -1 to insert before the first scene).
 * Returns the new scene's index, or -1 if nothing was inserted.
 */
export function insertSceneInEditor(editor: Editor, afterIndex: number, title?: string): number {
  const { state, view } = editor;
  const { schema } = state;
  const ranges = getSceneRanges(state.doc);

  const newIndex = ranges.length === 0 ? 0 : Math.max(0, Math.min(afterIndex + 1, ranges.length));
  const pos =
    ranges.length === 0
      ? state.doc.content.size
      : newIndex < ranges.length
        ? ranges[newIndex].from
        : state.doc.content.size;

  const headingText = (title ?? '').trim() || `Scene ${ranges.length + 1}`;
  const heading = schema.nodes.heading.create({ level: 2 }, schema.text(headingText));
  const paragraph = schema.nodes.paragraph.create();

  view.dispatch(state.tr.insert(pos, [heading, paragraph]));
  return newIndex;
}

/** Appends Markdown (e.g. a whole scene) to the end of the document as one undoable step. */
export function appendMarkdownInEditor(editor: Editor, markdown: string): boolean {
  const end = editor.state.doc.content.size;
  return editor.commands.insertContentAt(end, markdown, { contentType: 'markdown' } as never);
}

export function deleteSceneInEditor(editor: Editor, sceneIndex: number): boolean {
  const { state, view } = editor;
  const range = getSceneRanges(state.doc)[sceneIndex];
  if (!range) return false;
  view.dispatch(state.tr.delete(range.from, range.to));
  return true;
}
