import { markdownToHtml } from '../utils/markdown';
import type { SceneTitleMode } from '../services/settings';

const PRINT_ROOT_ID = 'print-root';

/**
 * Triggers PDF export via the native print-to-PDF engine.
 *
 * The manuscript is rendered into a dedicated `#print-root` element outside the
 * React tree, so printing works regardless of the current view mode (the
 * on-screen Preview pane isn't mounted in "editor" mode). Print CSS in
 * global.css hides the app and shows only this element.
 */
export function exportToPdf(markdown: string, sceneTitleMode: SceneTitleMode = 'show'): void {
  let root = document.getElementById(PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PRINT_ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }

  const article = document.createElement('article');
  article.className = `fiction-manuscript scene-title-${sceneTitleMode}`;
  article.innerHTML = markdownToHtml(markdown); // sanitized by markdownToHtml
  root.replaceChildren(article);

  const cleanup = () => {
    root?.replaceChildren();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
