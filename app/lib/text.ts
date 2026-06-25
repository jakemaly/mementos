/** Split text into overlapping chunks with word boundary alignment. */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { text: string; charStart: number; charEnd: number }[] {
  const chunks: { text: string; charStart: number; charEnd: number }[] = [];
  if (!text) return chunks;

  let start = 0;
  const textLength = text.length;

  while (start < textLength) {
    let end = start + chunkSize;

    if (end < textLength) {
      const lookbackLimit = Math.floor(chunkSize * 0.25);
      const sub = text.substring(end - lookbackLimit, end);

      const lastNewline = sub.lastIndexOf('\n');
      if (lastNewline !== -1) {
        end = end - lookbackLimit + lastNewline;
      } else {
        const lastSpace = sub.lastIndexOf(' ');
        if (lastSpace !== -1) {
          end = end - lookbackLimit + lastSpace;
        }
      }
    }

    const chunkText = text.substring(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, charStart: start, charEnd: end });
    }

    const nextStart = end - chunkOverlap;
    if (nextStart >= end) {
      start = end;
    } else if (nextStart <= start) {
      start = start + Math.max(1, Math.floor(chunkSize * 0.5));
    } else {
      start = nextStart;
    }
  }

  return chunks;
}
