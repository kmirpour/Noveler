/**
 * Triggers PDF export via the native print-to-PDF engine
 */
export function exportToPdf(): void {
  window.print();
}
