import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/**
 * Two revision aids drawn over the text without changing it:
 *  - comment anchors: passages the writer has left a note on (notes live in noveler.json);
 *  - echoes: the same word used again within a few lines.
 * Neither is written into the chapter file or included in any export.
 */

// --- Shared: text of a block with a map back to document positions ---------------------------------

interface BlockText {
  text: string;
  /** Document position of each character of `text`. */
  positions: number[];
}

function blockTexts(doc: PmNode): BlockText[] {
  const blocks: BlockText[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const positions: number[] = [];
    node.descendants((child, rel) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) positions.push(pos + 1 + rel + i);
        text += child.text;
      }
      return true;
    });
    if (text) blocks.push({ text, positions });
    return false;
  });
  return blocks;
}

// --- Comments -------------------------------------------------------------------------------------

export interface CommentAnchor {
  id: string;
  quote: string;
  text: string;
}

/** Where a quoted passage sits in the document, or null if the text has since been rewritten. */
export function findQuoteRange(doc: PmNode, quote: string): { from: number; to: number } | null {
  const needle = quote.trim();
  if (!needle) return null;
  for (const block of blockTexts(doc)) {
    const at = block.text.indexOf(needle);
    if (at >= 0) {
      return { from: block.positions[at], to: block.positions[at + needle.length - 1] + 1 };
    }
  }
  return null;
}

function commentDecorations(doc: PmNode, comments: CommentAnchor[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const comment of comments) {
    const range = findQuoteRange(doc, comment.quote);
    if (range) {
      decos.push(
        Decoration.inline(range.from, range.to, {
          class: 'comment-anchor',
          title: `Comment: ${comment.text}`,
          'data-comment-id': comment.id,
        })
      );
    }
  }
  return DecorationSet.create(doc, decos);
}

// --- Echoes ---------------------------------------------------------------------------------------

const ECHO_WINDOW = 30; // words
const STOPWORDS = new Set(
  (
    'that this with have from they were been their there what when which would could should about into than then ' +
    'them your said just like over some more very only also back down even still here where while because after ' +
    'before through each other those these being does will shall might must such much many most well were your ' +
    'yours ours hers his her him she you our its and the for not but are was had has did can any all out off too ' +
    'one two now how why who got get let own same both every upon once again away around until without within ' +
    "didn't don't wasn't hadn't couldn't wouldn't isn't aren't weren't doesn't won't can't that's there's it's i'm i'd " +
    "he'd she'd they'd we'd you'd i've you've we've they've"
  ).split(/\s+/)
);

/** A light stem so "glance" / "glanced" / "glances" count as the same word. */
function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’‘]/g, "'").replace(/'s$/, '');
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export interface EchoRange {
  from: number;
  to: number;
  word: string;
}

/** Finds content words that are repeated within ECHO_WINDOW words of each other. */
export function findEchoes(doc: PmNode): EchoRange[] {
  const tokens: { stem: string; from: number; to: number; word: string; index: number }[] = [];
  let wordIndex = 0;
  for (const block of blockTexts(doc)) {
    const regex = /\p{L}[\p{L}'’‘-]*/gu;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(block.text)) !== null) {
      wordIndex += 1;
      const word = match[0].replace(/['’‘-]+$/, '');
      // Names recur by nature; so do short and structural words.
      if (word.length < 4 || /^\p{Lu}/u.test(word) || STOPWORDS.has(word.toLowerCase().replace(/[’‘]/g, "'"))) continue;
      tokens.push({
        stem: stem(word),
        word,
        index: wordIndex,
        from: block.positions[match.index],
        to: block.positions[match.index + word.length - 1] + 1,
      });
    }
  }

  const lastSeen = new Map<string, number>(); // stem -> index into tokens
  const flagged = new Set<number>();
  tokens.forEach((token, i) => {
    const previous = lastSeen.get(token.stem);
    if (previous !== undefined && token.index - tokens[previous].index <= ECHO_WINDOW) {
      flagged.add(previous);
      flagged.add(i);
    }
    lastSeen.set(token.stem, i);
  });
  return Array.from(flagged)
    .sort((a, b) => a - b)
    .map((i) => ({ from: tokens[i].from, to: tokens[i].to, word: tokens[i].word }));
}

function echoDecorations(doc: PmNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findEchoes(doc).map((e) =>
      Decoration.inline(e.from, e.to, { class: 'echo-word', title: `“${e.word}” is repeated nearby` })
    )
  );
}

// --- Plugin ---------------------------------------------------------------------------------------

interface AidsState {
  comments: DecorationSet;
  echoes: DecorationSet;
}

export const writingAidsKey = new PluginKey<AidsState>('writingAids');

export interface WritingAidsOptions {
  getComments: () => CommentAnchor[];
  echoesEnabled: () => boolean;
}

/** Recomputes both overlays now (after a comment changes or the echo setting is toggled). */
export function refreshWritingAids(view: EditorView, options: WritingAidsOptions): void {
  if (view.isDestroyed) return;
  const doc = view.state.doc;
  view.dispatch(
    view.state.tr.setMeta(writingAidsKey, {
      comments: commentDecorations(doc, options.getComments()),
      echoes: options.echoesEnabled() ? echoDecorations(doc) : DecorationSet.empty,
    })
  );
}

export const WritingAids = Extension.create<WritingAidsOptions>({
  name: 'writingAids',

  addOptions() {
    return { getComments: () => [], echoesEnabled: () => false };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<AidsState>({
        key: writingAidsKey,
        state: {
          init(_, { doc }) {
            return {
              comments: commentDecorations(doc, options.getComments()),
              echoes: options.echoesEnabled() ? echoDecorations(doc) : DecorationSet.empty,
            };
          },
          apply(tr, prev) {
            const meta = tr.getMeta(writingAidsKey) as AidsState | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return prev;
            // Comments are few, so they are re-anchored at once; echoes follow the text and are
            // recomputed a moment after typing pauses (see `view` below).
            return {
              comments: commentDecorations(tr.doc, options.getComments()),
              echoes: prev.echoes.map(tr.mapping, tr.doc),
            };
          },
        },
        props: {
          decorations(state) {
            const s = this.getState(state);
            if (!s) return DecorationSet.empty;
            return s.echoes === DecorationSet.empty ? s.comments : s.comments.add(state.doc, s.echoes.find());
          },
        },
        view() {
          let timer: ReturnType<typeof setTimeout> | null = null;
          return {
            update(view, prevState) {
              if (view.state.doc === prevState.doc || !options.echoesEnabled()) return;
              if (timer) clearTimeout(timer);
              timer = setTimeout(() => refreshWritingAids(view, options), 500);
            },
            destroy() {
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
