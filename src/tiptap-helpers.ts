/**
 * TipTap JSON Node Builders
 *
 * Helper functions for building TipTap/ProseMirror JSON nodes
 * for Docmost's editor. Used for inserting diagrams and images.
 */

/**
 * Build a Draw.io diagram block node
 */
export function buildDrawioNode(attachmentId: string, src: string, title: string, align: 'left' | 'center' | 'right' = 'center'): object {
  return {
    type: 'drawio',
    attrs: {
      attachmentId,
      src,
      title,
      align,
    },
  };
}

/**
 * Build an Excalidraw diagram block node
 */
export function buildExcalidrawNode(attachmentId: string, src: string, title: string, align: 'left' | 'center' | 'right' = 'center'): object {
  return {
    type: 'excalidraw',
    attrs: {
      attachmentId,
      src,
      title,
      align,
    },
  };
}

/**
 * Build a paragraph node with text content
 */
export function buildParagraphNode(text: string): object {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  };
}

/**
 * Build a code block node (useful for Mermaid diagrams)
 */
export function buildCodeBlockNode(code: string, language: string = 'mermaid'): object {
  return {
    type: 'codeBlock',
    attrs: { language },
    content: [{ type: 'text', text: code }],
  };
}

/**
 * Append a node to existing TipTap document content
 * Handles various edge cases to preserve existing content
 */
export function appendNodeToDocument(document: any, node: object): any {
  // Normalize document to ensure we have a valid TipTap structure
  const normalized = normalizeDocument(document);

  return {
    ...normalized,
    content: [...normalized.content, node],
  };
}

/**
 * Normalize any document-like input to a valid TipTap document structure
 */
function normalizeDocument(document: any): { type: 'doc'; content: any[] } {
  // Handle null/undefined
  if (!document) {
    return { type: 'doc', content: [] };
  }

  // Handle string content (might be JSON or plain text)
  if (typeof document === 'string') {
    try {
      const parsed = JSON.parse(document);
      return normalizeDocument(parsed);
    } catch {
      // Plain text - wrap in paragraph
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: document }] }],
      };
    }
  }

  // Handle raw array of nodes
  if (Array.isArray(document)) {
    return { type: 'doc', content: document };
  }

  // Handle object without proper doc wrapper
  if (document.type !== 'doc') {
    // It's a single node, wrap it
    return { type: 'doc', content: [document] };
  }

  // Ensure content array exists
  if (!Array.isArray(document.content)) {
    return { type: 'doc', content: [] };
  }

  return document;
}

/**
 * Prepend a node to existing TipTap document content
 * Handles various edge cases to preserve existing content
 */
export function prependNodeToDocument(document: any, node: object): any {
  // Normalize document to ensure we have a valid TipTap structure
  const normalized = normalizeDocument(document);

  return {
    ...normalized,
    content: [node, ...normalized.content],
  };
}

/**
 * Build attachment URL from attachment data
 */
export function buildAttachmentUrl(attachmentId: string, fileName: string): string {
  const timestamp = Date.now();
  return `/api/files/${attachmentId}/${fileName}?t=${timestamp}`;
}

/**
 * Build markdown image syntax from attachment
 */
export function buildMarkdownImage(url: string, altText?: string): string {
  return `![${altText || 'Image'}](${url})`;
}
