# Docmost MCP Server

[![CI](https://github.com/johnkattenhorn/docmost-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/johnkattenhorn/docmost-mcp/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@johnkattenhorn/docmost-mcp.svg)](https://www.npmjs.com/package/@johnkattenhorn/docmost-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that connects AI assistants (like Claude, Cursor, etc.) to standard Docmost instances.

## Installation

```bash
# npm
npm install -g @johnkattenhorn/docmost-mcp

# or run directly with npx
npx @johnkattenhorn/docmost-mcp
```

## Features

- Works with any standard Docmost installation (no modifications needed)
- Full support for spaces, pages, comments, search, and more
- Cookie-based JWT authentication
- Docker deployment with auto-restart

## Available Tools

### Space Tools
| Tool | Description |
|------|-------------|
| `docmost_list_spaces` | List all spaces in the workspace |
| `docmost_get_space` | Get details of a specific space |
| `docmost_create_space` | Create a new space |
| `docmost_update_space` | Update an existing space |
| `docmost_delete_space` | Delete a space |

### Page Tools
| Tool | Description |
|------|-------------|
| `docmost_list_pages` | List pages in a space |
| `docmost_get_page` | Get page details and content |
| `docmost_create_page` | Create a new page |
| `docmost_update_page` | Update page metadata |
| `docmost_update_page_markdown` | Update page content with markdown |
| `docmost_delete_page` | Delete a page |
| `docmost_get_recent_pages` | Get recently updated pages |
| `docmost_get_page_history` | Get page edit history |
| `docmost_move_page` | Move page to new position |
| `docmost_move_page_to_parent` | Move page to different parent or root |
| `docmost_bulk_create_pages` | Create multiple pages at once |
| `docmost_import_page` | Import page from markdown/HTML |
| `docmost_export_page` | Export page as HTML/Markdown/PDF |

### Attachment & Embedding Tools
| Tool | Description |
|------|-------------|
| `docmost_upload_attachment` | Upload image/file to a page |
| `docmost_get_attachment_info` | Get attachment metadata by ID |
| `docmost_embed_image` | Upload and insert image in one operation |
| `docmost_embed_from_cdn` | Embed image from CDN URL (link or transfer modes) |

### Diagram Tools
| Tool | Description |
|------|-------------|
| `docmost_insert_drawio_block` | Insert native Draw.io diagram from base64 SVG |
| `docmost_insert_drawio_from_cdn` | Insert Draw.io diagram from CDN URL |
| `docmost_insert_excalidraw_block` | Insert native Excalidraw diagram from base64 SVG |
| `docmost_insert_excalidraw_from_cdn` | Insert Excalidraw diagram from CDN URL |

### Search Tools
| Tool | Description |
|------|-------------|
| `docmost_search` | Search for pages in a space |
| `docmost_search_suggest` | Get search suggestions |

### Comment Tools
| Tool | Description |
|------|-------------|
| `docmost_list_comments` | List comments on a page |
| `docmost_create_comment` | Create a comment |
| `docmost_delete_comment` | Delete a comment |

### Workspace Tools
| Tool | Description |
|------|-------------|
| `docmost_get_workspace` | Get workspace info |
| `docmost_list_workspace_members` | List workspace members |
| `docmost_get_current_user` | Get current user info |

## Page Composition Order

Docmost pages are TipTap documents with two flavours of content:

- **Markdown-equivalent nodes** — headings, paragraphs, lists, tables, code blocks,
  blockquotes. These round-trip cleanly through `docmost_update_page_markdown`.
- **Native TipTap nodes** — `drawio`, `excalidraw`, and image attachments.
  These have no markdown equivalent and only exist as structured nodes in the
  document tree.

When composing a page, build it in this order:

1. **Markdown body first** with `docmost_update_page_markdown` (operation: `replace`).
2. **Diagram blocks last** via `docmost_insert_drawio_block`, `docmost_insert_drawio_from_cdn`,
   `docmost_insert_excalidraw_block`, or `docmost_insert_excalidraw_from_cdn`.
3. **Image embeds anywhere** with `docmost_embed_from_cdn` — these correctly
   append/prepend to existing content of either kind.

Avoid calling `docmost_update_page_markdown(replace)` *after* you've inserted
diagram blocks. The replace operation rewrites the page from markdown, and
since native nodes have no markdown form, they're dropped. Use
`docmost_update_page_markdown(append)` or `docmost_update_page_markdown(prepend)`
to add prose around existing diagram blocks without losing them.

For documents that mix prose and diagrams, the cleanest workflow is:

1. Build out the markdown body (`replace`).
2. `prepend` any header/title images.
3. `append` diagram blocks at the end, in order.
4. Use `append` operations on `update_page_markdown` to add explanatory prose
   between or after diagram blocks.

## Setup

### 1. Authentication

You can authenticate using either email/password or an auth token:

**Option A: Email/Password (recommended)**
```bash
DOCMOST_URL=https://your-docmost-instance.com
DOCMOST_EMAIL=your-email@example.com
DOCMOST_PASSWORD=your-password
```

**Option B: Auth Token**
1. Log into your Docmost instance in a browser
2. Open Developer Tools (F12) → Application → Cookies
3. Copy the `authToken` cookie value

```bash
DOCMOST_URL=https://your-docmost-instance.com
DOCMOST_AUTH_TOKEN=your_auth_token_here
```

### 2. Create Environment File

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run with Docker

```bash
docker compose up -d
```

## Usage with Claude Code

Add to your Claude Code MCP configuration (`~/.claude.json` or settings):

```json
{
  "mcpServers": {
    "docmost": {
      "command": "node",
      "args": ["/path/to/docmost-mcp/dist/index.js"],
      "env": {
        "DOCMOST_URL": "https://your-docmost-instance.com",
        "DOCMOST_EMAIL": "your-email@example.com",
        "DOCMOST_PASSWORD": "your-password"
      }
    }
  }
}
```

Or with Docker:

```json
{
  "mcpServers": {
    "docmost": {
      "command": "docker",
      "args": ["exec", "-i", "docmost-mcp", "node", "dist/index.js"],
      "env": {}
    }
  }
}
```

## Local Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development mode
pnpm run dev
```

## Important Notes

- The auth token expires after 30 days. You'll need to get a new one periodically.
- This uses internal Docmost API endpoints which may change with updates.
- Some operations require specific permissions in Docmost.

## License

MIT
