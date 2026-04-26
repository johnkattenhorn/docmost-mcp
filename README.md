# Docmost MCP Server

A Model Context Protocol (MCP) server that connects AI assistants (like Claude, Cursor, etc.) to standard Docmost instances.

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

### Attachment Tools
| Tool | Description |
|------|-------------|
| `docmost_upload_attachment` | Upload image/file to a page |
| `docmost_get_attachment_info` | Get attachment metadata by ID |
| `docmost_embed_image` | Upload and insert image in one operation |

### Diagram Tools
| Tool | Description |
|------|-------------|
| `docmost_insert_drawio_block` | Insert native Draw.io diagram (editable in Docmost) |
| `docmost_insert_excalidraw_block` | Insert native Excalidraw diagram (editable in Docmost) |

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

## Setup

### 1. Get Authentication Token

You need to get the `authToken` cookie from your Docmost session:

1. Log into your Docmost instance in a browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies
4. Find the `authToken` cookie and copy its value

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env`:

```bash
DOCMOST_URL=https://docmost.khn.family
DOCMOST_AUTH_TOKEN=your_auth_token_here
```

### 3. Run with Docker

```bash
docker compose up -d
```

## Usage with Claude Code

Add to your Claude Code MCP configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docmost": {
      "command": "docker",
      "args": ["exec", "-i", "docmost-mcp-server", "node", "dist/index.js"],
      "env": {}
    }
  }
}
```

Or run locally:

```json
{
  "mcpServers": {
    "docmost": {
      "command": "node",
      "args": ["/path/to/docmost-mcp-server/dist/index.js"],
      "env": {
        "DOCMOST_URL": "https://docmost.khn.family",
        "DOCMOST_AUTH_TOKEN": "your_token"
      }
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
