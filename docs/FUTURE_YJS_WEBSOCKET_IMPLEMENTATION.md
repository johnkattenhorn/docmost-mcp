# Future Implementation: Yjs WebSocket Content Updates

## Overview

This document outlines how to implement direct content updates via Yjs/Hocuspocus WebSocket connections, which would allow updating page content without changing the page ID.

## Current Limitation

Docmost's REST API (`/api/pages/update`) only supports metadata updates. Content is managed through a Yjs CRDT system via WebSocket connections to the Hocuspocus collaboration server.

## Docmost Architecture

### Dual Content Storage
Docmost stores page content in multiple formats:
- `content` (jsonb): ProseMirror document structure for server-side processing
- `ydoc` (bytea): Yjs binary CRDT state for real-time collaboration
- `textContent` (text): Plain text for full-text search

### Collaboration Server
- Runs on port 3001 (separate from main API on port 3000)
- Uses Hocuspocus (Yjs WebSocket server)
- Handles real-time collaborative editing
- Persists changes via `onStoreDocument` handler (debounced 2 seconds)

## Implementation Approach

### Required Dependencies
```json
{
  "dependencies": {
    "yjs": "^13.x",
    "y-websocket": "^1.x",
    "y-prosemirror": "^1.x",
    "@hocuspocus/provider": "^2.x"
  }
}
```

### Connection Flow

1. **Establish WebSocket Connection**
```typescript
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

async function connectToDocument(pageId: string, authToken: string): Promise<HocuspocusProvider> {
  const ydoc = new Y.Doc();

  const provider = new HocuspocusProvider({
    url: 'ws://localhost:3001',  // Docmost collaboration server
    name: pageId,  // Document name is the page ID
    document: ydoc,
    token: authToken,  // JWT auth token from login
    // May need additional auth headers
  });

  return new Promise((resolve, reject) => {
    provider.on('synced', () => resolve(provider));
    provider.on('authenticationFailed', () => reject(new Error('Auth failed')));
    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
}
```

2. **Update Document Content**
```typescript
import { TiptapTransformer } from '@hocuspocus/transformer';

async function updateDocumentContent(
  provider: HocuspocusProvider,
  newContent: object  // TipTap/ProseMirror JSON
): Promise<void> {
  const ydoc = provider.document;

  // Get the Y.XmlFragment that stores the document content
  // Docmost likely uses 'default' or 'prosemirror' as the fragment name
  const fragment = ydoc.getXmlFragment('default');

  // Option 1: Use TiptapTransformer to convert and apply
  // This replaces all content
  ydoc.transact(() => {
    // Clear existing content
    fragment.delete(0, fragment.length);

    // Insert new content
    // Need to convert ProseMirror JSON to Y.XmlFragment nodes
    const yContent = TiptapTransformer.toYdoc(newContent, 'default');
    // Merge or apply the new content
  });

  // Option 2: Direct Yjs update message
  // const update = Y.encodeStateAsUpdate(newYdoc);
  // Y.applyUpdate(ydoc, update);
}
```

3. **Disconnect and Cleanup**
```typescript
async function disconnectFromDocument(provider: HocuspocusProvider): Promise<void> {
  // Wait for pending changes to sync
  await new Promise(resolve => setTimeout(resolve, 3000));
  provider.disconnect();
  provider.destroy();
}
```

### Full Implementation Example

```typescript
async function updatePageContentViaWebSocket(
  pageId: string,
  spaceId: string,
  markdownContent: string,
  authToken: string
): Promise<void> {
  // 1. Convert markdown to TipTap JSON
  const tipTapJson = await markdownToTipTapJSON(markdownContent);

  // 2. Connect to the collaboration server
  const provider = await connectToDocument(pageId, authToken);

  try {
    // 3. Wait for initial sync
    await waitForSync(provider);

    // 4. Update the document
    await updateDocumentContent(provider, tipTapJson);

    // 5. Wait for changes to persist (Hocuspocus debounces writes)
    await new Promise(resolve => setTimeout(resolve, 3000));

  } finally {
    // 6. Disconnect
    await disconnectFromDocument(provider);
  }
}
```

## Research Needed

### Authentication
- How does Docmost authenticate WebSocket connections?
- Is it the same JWT token as REST API?
- Are there additional headers needed?

### Document Naming
- Confirm the document name format (likely `pageId`)
- Check if space ID is part of the document identifier

### Y.XmlFragment Structure
- What fragment name does Docmost use? (`default`, `prosemirror`, `content`?)
- What's the exact structure of the Yjs document?

### TipTap Extensions
- Which extensions does Docmost's collaboration server expect?
- Need to match client-side extensions for proper serialization

## Testing Strategy

1. **Manual WebSocket Testing**
   - Use browser dev tools to inspect WebSocket traffic when editing a page
   - Capture the authentication flow and message format

2. **Hocuspocus Client Testing**
   - Create a standalone test script that connects to the collaboration server
   - Verify authentication works with the REST API token

3. **Content Update Testing**
   - Start with simple text updates
   - Progress to complex formatting (headings, lists, code blocks)
   - Test concurrent edit scenarios

## References

- [Hocuspocus Documentation](https://hocuspocus.dev/)
- [Yjs Documentation](https://docs.yjs.dev/)
- [TipTap Collaboration Guide](https://tiptap.dev/docs/collaboration)
- [Docmost GitHub](https://github.com/docmost/docmost)
- [y-prosemirror Bindings](https://github.com/yjs/y-prosemirror)

## Docmost Source Code Locations

Key files to examine in the Docmost repository:
- `apps/server/src/collaboration/` - Hocuspocus server setup
- `apps/server/src/core/page/` - Page service and persistence
- `apps/client/src/features/editor/` - TipTap editor configuration
- `packages/editor-ext/` - Custom TipTap extensions

## Benefits Over Delete/Recreate

| Aspect | Delete/Recreate | WebSocket Update |
|--------|-----------------|------------------|
| Page ID | Changes | Preserved |
| History | Lost | Preserved |
| Links | Break | Work |
| Sidebar position | May change | Preserved |
| Complexity | Simple | Complex |
| Reliability | High | Depends on WS stability |
