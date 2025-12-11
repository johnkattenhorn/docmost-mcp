#!/usr/bin/env node
/**
 * Docmost MCP Server
 *
 * Model Context Protocol server for connecting AI assistants to standard Docmost instances.
 * Works with any Docmost installation without requiring modifications.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { DocmostClient } from './client.js';
import { markdownToTipTapJSON, htmlToTipTapJSON } from './markdown-converter.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

// Load environment variables
dotenvConfig();

// Logging
const DEBUG = process.env.MCP_DEBUG === 'true';
const logFile = resolve(process.cwd(), 'docmost-mcp.log');

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  if (DEBUG) {
    console.error(logMessage);
  }

  try {
    const logDir = dirname(logFile);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    writeFileSync(logFile, logMessage, { flag: 'a' });
  } catch {
    // Ignore logging errors
  }
}

// Configuration
const config = {
  baseUrl: process.env.DOCMOST_URL || 'http://localhost:3000',
  authToken: process.env.DOCMOST_AUTH_TOKEN,
  email: process.env.DOCMOST_EMAIL,
  password: process.env.DOCMOST_PASSWORD,
  // Authentik proxy authentication
  authentikUsername: process.env.AUTHENTIK_USERNAME,
  authentikToken: process.env.AUTHENTIK_TOKEN,
  debug: DEBUG,
};

log(`Starting Docmost MCP Server`);
log(`Docmost URL: ${config.baseUrl}`);
log(`Auth Token: ${config.authToken ? '***' : 'not set'}`);
log(`Email: ${config.email || 'not set'}`);
log(`Authentik: ${config.authentikUsername ? `${config.authentikUsername} (token set)` : 'not configured'}`);

// Initialize client
const client = new DocmostClient(config);

// Initialize MCP server
const server = new McpServer({
  name: 'docmost',
  version: '1.0.0',
});

async function main() {
  try {
    // Authenticate with Docmost
    log('Authenticating with Docmost...');
    await client.login();
    const user = await client.getCurrentUser();
    log(`Authenticated as: ${user.user?.name || user.user?.email || 'Unknown'}`);

    // ==================== SPACE TOOLS ====================

    server.tool(
      'docmost_list_spaces',
      'List all spaces in the Docmost workspace',
      {
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`list_spaces called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.listSpaces(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_get_space',
      'Get details of a specific space',
      {
        spaceId: z.string().describe('ID of the space to retrieve'),
      },
      async (params) => {
        log(`get_space called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getSpace(params.spaceId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_create_space',
      'Create a new space',
      {
        name: z.string().describe('Name of the space'),
        description: z.string().optional().describe('Description of the space'),
        slug: z.string().optional().describe('URL-friendly slug for the space'),
      },
      async (params) => {
        log(`create_space called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.createSpace(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_update_space',
      'Update an existing space',
      {
        spaceId: z.string().describe('ID of the space to update'),
        name: z.string().optional().describe('New name for the space'),
        description: z.string().optional().describe('New description'),
        slug: z.string().optional().describe('New URL-friendly slug'),
      },
      async (params) => {
        log(`update_space called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.updateSpace(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_delete_space',
      'Delete a space',
      {
        spaceId: z.string().describe('ID of the space to delete'),
      },
      async (params) => {
        log(`delete_space called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.deleteSpace(params.spaceId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== PAGE TOOLS ====================

    server.tool(
      'docmost_get_page',
      'Get details of a specific page including its content',
      {
        pageId: z.string().describe('ID of the page to retrieve'),
        spaceId: z.string().describe('ID of the space containing the page'),
      },
      async (params) => {
        log(`get_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getPage(params.pageId, params.spaceId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_list_pages',
      'List pages in a space (sidebar view)',
      {
        spaceId: z.string().describe('ID of the space'),
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`list_pages called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getSidebarPages(params.spaceId, {
            page: params.page,
            limit: params.limit,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_create_page',
      'Create a new page in a space',
      {
        title: z.string().describe('Title of the page'),
        spaceId: z.string().describe('ID of the space to create the page in'),
        parentPageId: z.string().optional().describe('ID of the parent page (for nested pages)'),
        content: z.any().optional().describe('Page content in TipTap JSON format'),
      },
      async (params) => {
        log(`create_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.createPage(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_update_page',
      'Update an existing page',
      {
        pageId: z.string().describe('ID of the page to update'),
        title: z.string().optional().describe('New title for the page'),
        content: z.any().optional().describe('New content in TipTap JSON format'),
        icon: z.string().optional().describe('Page icon (emoji)'),
        coverPhoto: z.string().optional().describe('Cover photo URL'),
      },
      async (params) => {
        log(`update_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.updatePage(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_update_page_markdown',
      'Update an existing page using Markdown content. This is the recommended way to update page content as it handles the TipTap JSON conversion automatically.',
      {
        pageId: z.string().describe('ID of the page to update'),
        title: z.string().optional().describe('New title for the page'),
        content: z.string().optional().describe('New content in Markdown format'),
        icon: z.string().optional().describe('Page icon (emoji)'),
        coverPhoto: z.string().optional().describe('Cover photo URL'),
      },
      async (params) => {
        log(`update_page_markdown called with: ${JSON.stringify(params)}`);
        try {
          const updateData: {
            pageId: string;
            title?: string;
            content?: object;
            icon?: string;
            coverPhoto?: string;
          } = {
            pageId: params.pageId,
          };

          if (params.title) {
            updateData.title = params.title;
          }

          if (params.content) {
            // Convert markdown to TipTap JSON
            updateData.content = await markdownToTipTapJSON(params.content);
            log(`Converted markdown to TipTap JSON: ${JSON.stringify(updateData.content).substring(0, 200)}...`);
          }

          if (params.icon) {
            updateData.icon = params.icon;
          }

          if (params.coverPhoto) {
            updateData.coverPhoto = params.coverPhoto;
          }

          const result = await client.updatePage(updateData);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log(`update_page_markdown error: ${msg}`);
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_delete_page',
      'Delete a page',
      {
        pageId: z.string().describe('ID of the page to delete'),
      },
      async (params) => {
        log(`delete_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.deletePage(params.pageId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_get_recent_pages',
      'Get recently updated pages in a space',
      {
        spaceId: z.string().describe('ID of the space'),
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`get_recent_pages called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getRecentPages(params.spaceId, {
            page: params.page,
            limit: params.limit,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_get_page_history',
      'Get the edit history of a page',
      {
        pageId: z.string().describe('ID of the page'),
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`get_page_history called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getPageHistory(params.pageId, {
            page: params.page,
            limit: params.limit,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== SEARCH TOOLS ====================

    server.tool(
      'docmost_search',
      'Search for pages in a space',
      {
        query: z.string().describe('Search query'),
        spaceId: z.string().describe('ID of the space to search in'),
      },
      async (params) => {
        log(`search called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.search(params.query, params.spaceId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_search_suggest',
      'Get search suggestions across all spaces',
      {
        query: z.string().describe('Search query for suggestions'),
      },
      async (params) => {
        log(`search_suggest called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.searchSuggest(params.query);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== COMMENT TOOLS ====================

    server.tool(
      'docmost_list_comments',
      'List comments on a page',
      {
        pageId: z.string().describe('ID of the page'),
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`list_comments called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.listComments(params.pageId, {
            page: params.page,
            limit: params.limit,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_create_comment',
      'Create a comment on a page',
      {
        pageId: z.string().describe('ID of the page to comment on'),
        content: z.any().describe('Comment content'),
        parentCommentId: z.string().optional().describe('ID of parent comment for replies'),
      },
      async (params) => {
        log(`create_comment called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.createComment(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_delete_comment',
      'Delete a comment',
      {
        commentId: z.string().describe('ID of the comment to delete'),
      },
      async (params) => {
        log(`delete_comment called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.deleteComment(params.commentId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== WORKSPACE TOOLS ====================

    server.tool(
      'docmost_get_workspace',
      'Get information about the current workspace',
      {},
      async () => {
        log('get_workspace called');
        try {
          const result = await client.getWorkspace();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_list_workspace_members',
      'List members of the workspace',
      {
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of items per page'),
      },
      async (params) => {
        log(`list_workspace_members called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getWorkspaceMembers(params);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_get_current_user',
      'Get information about the currently authenticated user',
      {},
      async () => {
        log('get_current_user called');
        try {
          const result = await client.getCurrentUser();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== EXPORT TOOLS ====================

    server.tool(
      'docmost_export_page',
      'Export a page in various formats',
      {
        pageId: z.string().describe('ID of the page to export'),
        format: z.enum(['html', 'markdown', 'pdf']).describe('Export format'),
        includeChildren: z.boolean().optional().describe('Include child pages (creates ZIP)'),
      },
      async (params) => {
        log(`export_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.exportPage(params.pageId, params.format, params.includeChildren);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // ==================== IMPORT TOOLS ====================

    server.tool(
      'docmost_import_page',
      'Import/create a page with markdown or HTML content. This is the recommended way to create pages with content.',
      {
        spaceId: z.string().describe('ID of the space to create the page in'),
        title: z.string().describe('Title of the page'),
        content: z.string().describe('Page content in markdown or HTML format'),
        format: z.enum(['markdown', 'html']).optional().describe('Content format (default: markdown)'),
      },
      async (params) => {
        log(`import_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.importPage(
            params.spaceId,
            params.title,
            params.content,
            params.format || 'markdown'
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    // Connect to MCP transport
    log('Starting MCP server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('Docmost MCP Server running successfully');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log(`Fatal error: ${msg}`);
    console.error(`Fatal error: ${msg}`);
    process.exit(1);
  }
}

// Start server
main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
