/**
 * Markdown to TipTap JSON Converter
 *
 * Converts Markdown content to TipTap/ProseMirror JSON format
 * for updating Docmost pages via the API.
 */

import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { marked } from 'marked';

// Configure marked for GFM (GitHub Flavored Markdown)
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Extensions used by Docmost - StarterKit covers the basics, Link for hyperlinks
const extensions = [
  StarterKit,
  Link.configure({
    openOnClick: false,
  }),
];

/**
 * Convert Markdown string to TipTap JSON format
 *
 * @param markdown - The markdown content to convert
 * @returns TipTap JSON document structure
 */
export async function markdownToTipTapJSON(markdown: string): Promise<object> {
  // First convert markdown to HTML
  const html = await marked.parse(markdown);

  // Then convert HTML to TipTap JSON
  const json = generateJSON(html, extensions);

  return json;
}

/**
 * Convert HTML string to TipTap JSON format
 *
 * @param html - The HTML content to convert
 * @returns TipTap JSON document structure
 */
export function htmlToTipTapJSON(html: string): object {
  return generateJSON(html, extensions);
}
