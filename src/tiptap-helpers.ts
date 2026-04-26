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
 * Build an image node
 */
export function buildImageNode(src: string, alt?: string, title?: string): object {
  return {
    type: 'image',
    attrs: {
      src,
      alt: alt || '',
      title: title || '',
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
 */
export function appendNodeToDocument(document: any, node: object): any {
  if (!document || !document.content) {
    return {
      type: 'doc',
      content: [node],
    };
  }

  return {
    ...document,
    content: [...document.content, node],
  };
}

/**
 * Prepend a node to existing TipTap document content
 */
export function prependNodeToDocument(document: any, node: object): any {
  if (!document || !document.content) {
    return {
      type: 'doc',
      content: [node],
    };
  }

  return {
    ...document,
    content: [node, ...document.content],
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
