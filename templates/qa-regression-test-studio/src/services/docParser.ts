/**
 * Extracts plain-text test steps from an uploaded Word (.docx) document.
 *
 * Uses mammoth.js which runs entirely in the browser — no server-side
 * processing, no file upload to an external service. The document bytes never
 * leave the browser.
 *
 * The parser splits on heading-like patterns (bold first line, "To ..." lines)
 * to produce separate test sections, each with its ordered steps. This matches
 * the CoreCivic test script format where each section is a distinct scenario.
 */
import mammoth from 'mammoth';

export interface ParsedTestSection {
  name: string;
  steps: string[];
}

export interface ParsedDocument {
  title: string;
  sections: ParsedTestSection[];
  rawText: string;
}

/** Patterns that signal a new test section. */
const SECTION_PATTERN =
  /^(adding|to\s+(edit|delete|create|update|verify|remove|add)|test\s+\d|scenario|step\s+\d)/i;

export async function parseTestDocument(
  file: File
): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const rawText = result.value;

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('The document appears to be empty.');
  }

  // First non-empty line is the title (e.g. "Test Script: Medical Status")
  const title = lines[0].replace(/^test\s+script:\s*/i, '').trim();

  const sections: ParsedTestSection[] = [];
  let currentSection: ParsedTestSection | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (SECTION_PATTERN.test(line)) {
      if (currentSection && currentSection.steps.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: line.replace(/:$/, '').trim(), steps: [] };
      continue;
    }

    // Flat document with no section headers — use the doc title as the section
    if (!currentSection) {
      currentSection = { name: title, steps: [] };
    }

    // Clean up numbered prefixes and bullet markers
    const cleaned = line
      .replace(/^\d+\.\s*/, '')
      .replace(/^[•◦▪○]\s*/, '')
      .trim();

    if (cleaned) {
      currentSection.steps.push(cleaned);
    }
  }

  if (currentSection && currentSection.steps.length > 0) {
    sections.push(currentSection);
  }

  if (sections.length === 0) {
    throw new Error(
      'Could not find any test sections in the document. ' +
        'Expected headings like "Adding...", "To edit...", or "To delete...".'
    );
  }

  return { title, sections, rawText };
}
