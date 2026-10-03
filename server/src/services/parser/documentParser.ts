import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  text: string;
  pages: ParsedPage[];
  totalCharacters: number;
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

/**
 * Extracts readable text and page metadata from TXT and PDF documents.
 */
export async function parseDocumentFile(filePath: string, fileType: 'pdf' | 'txt'): Promise<ParsedDocument> {
  if (!fs.existsSync(filePath)) {
    throw new DocumentParseError('File does not exist on disk.');
  }

  const fileBuffer = await fs.promises.readFile(filePath);

  if (fileBuffer.length === 0) {
    throw new DocumentParseError('The uploaded file is empty (0 bytes).');
  }

  if (fileType === 'txt') {
    return parseTextBuffer(fileBuffer);
  } else if (fileType === 'pdf') {
    return parsePdfBuffer(fileBuffer);
  } else {
    throw new DocumentParseError(`Unsupported document type: ${fileType}`);
  }
}

function parseTextBuffer(buffer: Buffer): ParsedDocument {
  // Strip UTF-8 BOM if present and normalize line endings
  let text = buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.substring(1);
  }
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (text.length === 0) {
    throw new DocumentParseError('Text file is empty or contains only whitespace.');
  }

  return {
    text,
    pages: [{ pageNumber: 1, text }],
    totalCharacters: text.length,
  };
}

async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const pages: ParsedPage[] = [];
    let combinedText = '';

    if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        const cleanText = (page.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        if (cleanText) {
          pages.push({
            pageNumber: page.num,
            text: cleanText,
          });
          combinedText += `\n[[PAGE_${page.num}]]\n${cleanText}\n`;
        }
      }
    } else if (result.text) {
      const cleanText = result.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      pages.push({
        pageNumber: 1,
        text: cleanText,
      });
      combinedText = cleanText;
    }

    const meaningfulChars = combinedText.replace(/\[\[PAGE_\d+\]\]/g, '').trim();

    if (meaningfulChars.length < 10) {
      throw new DocumentParseError(
        'No extractable text found in this PDF. The document may be a scanned image or protected.'
      );
    }

    return {
      text: combinedText.trim(),
      pages,
      totalCharacters: meaningfulChars.length,
    };
  } catch (err: unknown) {
    if (err instanceof DocumentParseError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    throw new DocumentParseError(`Failed to parse PDF document: ${msg}`);
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore destroy cleanup errors
      }
    }
  }
}
