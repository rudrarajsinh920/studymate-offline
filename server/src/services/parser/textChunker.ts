import crypto from 'crypto';
import { ParsedDocument } from './documentParser';
import { NewChunk } from '../../db/repositories/documentRepository';

export interface ChunkingOptions {
  chunkSize?: number; // Target characters per chunk (default: 600)
  chunkOverlap?: number; // Character overlap between chunks (default: 100)
}

interface TextSlice {
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Splits parsed document pages into indexed chunks with preserved page metadata
 * and accurate character offset positions into the source text.
 */
export function chunkDocument(
  documentId: string,
  parsedDoc: ParsedDocument,
  options: ChunkingOptions = {}
): NewChunk[] {
  const chunkSize = options.chunkSize ?? 600;
  const chunkOverlap = options.chunkOverlap ?? 100;

  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be strictly smaller than chunkSize');
  }

  const chunks: NewChunk[] = [];
  let globalChunkIndex = 0;
  let pageBaseOffset = 0;

  for (const page of parsedDoc.pages) {
    const pageText = page.text;
    if (!pageText || pageText.trim().length === 0) continue;

    const pageSlices = splitTextWithOverlap(pageText, chunkSize, chunkOverlap);

    for (const slice of pageSlices) {
      const cleanChunk = slice.text.trim();
      if (cleanChunk.length === 0) continue;

      // True document-level character offsets based on slice boundaries
      const leadingWhitespace = slice.text.length - slice.text.trimStart().length;
      const charStart = pageBaseOffset + slice.startIndex + leadingWhitespace;
      const charEnd = charStart + cleanChunk.length;
      const tokenCount = Math.max(1, Math.ceil(cleanChunk.length / 4));

      chunks.push({
        id: crypto.randomUUID(),
        document_id: documentId,
        chunk_index: globalChunkIndex++,
        content: cleanChunk,
        page_number: page.pageNumber,
        char_start: charStart,
        char_end: charEnd,
        token_count: tokenCount,
      });
    }

    // Advance page base offset to maintain global coordinate integrity across pages
    pageBaseOffset += pageText.length + 1; // +1 for newline between pages
  }

  return chunks;
}

/**
 * Splits text into chunks respecting semantic boundaries (paragraphs, sentences, words)
 * and returns exact slice index boundaries.
 */
function splitTextWithOverlap(text: string, chunkSize: number, chunkOverlap: number): TextSlice[] {
  if (text.length <= chunkSize) {
    return [{ text, startIndex: 0, endIndex: text.length }];
  }

  const slices: TextSlice[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= text.length) {
      const sliceText = text.slice(startIndex);
      slices.push({
        text: sliceText,
        startIndex,
        endIndex: text.length,
      });
      break;
    }

    // Attempt to break at natural boundaries in order of preference
    const slice = text.slice(startIndex, endIndex);
    let splitPoint = -1;

    // 1. Double newline (paragraph break)
    const lastParagraph = slice.lastIndexOf('\n\n');
    if (lastParagraph > chunkSize * 0.4) {
      splitPoint = lastParagraph + 2;
    }

    // 2. Single newline
    if (splitPoint === -1) {
      const lastNewline = slice.lastIndexOf('\n');
      if (lastNewline > chunkSize * 0.4) {
        splitPoint = lastNewline + 1;
      }
    }

    // 3. Sentence end (period, exclamation, question mark followed by space)
    if (splitPoint === -1) {
      const sentenceMatch = slice.search(/[.!?]\s+(?=[^.!?]*$)/);
      if (sentenceMatch !== -1 && sentenceMatch > chunkSize * 0.4) {
        splitPoint = sentenceMatch + 2;
      }
    }

    // 4. Word boundary (space)
    if (splitPoint === -1) {
      const lastSpace = slice.lastIndexOf(' ');
      if (lastSpace > chunkSize * 0.3) {
        splitPoint = lastSpace + 1;
      }
    }

    // 5. Fallback: hard cut if no boundary found
    if (splitPoint === -1) {
      splitPoint = chunkSize;
    }

    const actualEnd = startIndex + splitPoint;
    const chunkContent = text.slice(startIndex, actualEnd);

    slices.push({
      text: chunkContent,
      startIndex,
      endIndex: actualEnd,
    });

    // Move next startIndex forward with overlap
    const step = Math.max(1, splitPoint - chunkOverlap);
    startIndex += step;
  }

  return slices;
}
