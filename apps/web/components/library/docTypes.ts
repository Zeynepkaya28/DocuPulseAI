/** File type → SF Symbol and short label. // HIG: lists-and-tables */
export const TYPE_SYMBOL: Record<string, string> = {
  "application/pdf": "doc.richtext",
  "text/plain": "doc.plaintext",
  "text/csv": "tablecells",
  "text/markdown": "text.document",
  ".pdf": "doc.richtext",
  ".txt": "doc.plaintext",
  ".csv": "tablecells",
  ".md": "text.document",
  ".markdown": "text.document",
};

export const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "text/markdown": "Markdown",
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
