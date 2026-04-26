#!/usr/bin/env node
/**
 * Docmost MCP Server
 *
 * Model Context Protocol server for connecting AI assistants to standard Docmost instances.
 * Works with any Docmost installation without requiring modifications.
 *
 * Supports both STDIO and HTTP transports:
 * - Default: STDIO transport for local CLI usage
 * - HTTP mode: Use --http flag for Docker/remote deployment
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { DocmostClient } from './client.js';
import {
  buildDrawioNode,
  buildExcalidrawNode,
  buildAttachmentUrl,
  buildMarkdownImage,
  appendNodeToDocument,
  prependNodeToDocument,
} from './tiptap-helpers.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { logger } from './utils/observability.js';

// Load environment variables
dotenvConfig();

// HTTP mode and port configuration
const httpMode = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http';
const httpPort = parseInt(process.env.PORT || '3000', 10);

// Debug mode flag
const DEBUG = process.env.MCP_DEBUG === 'true';

// Legacy log function that uses the new logger
function log(message: string) {
  logger.debug(message);
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

logger.info('Starting Docmost MCP Server', {
  baseUrl: config.baseUrl,
  hasAuthToken: !!config.authToken,
  email: config.email || 'not set',
  authentik: config.authentikUsername ? `${config.authentikUsername} (token set)` : 'not configured',
});

// Initialize client
const client = new DocmostClient(config);

/**
 * Factory function to create a new MCP server instance with all tools registered.
 * IMPORTANT: Each SSE connection needs its own Server instance.
 * The MCP SDK requires one Server per transport connection.
 */
function buildServer(client: DocmostClient): McpServer {
  const server = new McpServer({
    name: 'docmost',
    version: '1.0.0',
  });

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
      'Create a new page with markdown content. Supports nested pages via parentPageId.',
      {
        title: z.string().describe('Title of the page'),
        spaceId: z.string().describe('ID of the space to create the page in'),
        parentPageId: z.string().optional().describe('ID of the parent page (for nested pages)'),
        content: z.string().optional().describe('Page content in Markdown format'),
      },
      async (params) => {
        log(`create_page called with: ${JSON.stringify(params)}`);
        try {
          // Use createPage which properly handles parentPageId with format: 'markdown'
          const result = await client.createPage({
            title: params.title,
            spaceId: params.spaceId,
            parentPageId: params.parentPageId,
            content: params.content,
            format: 'markdown',
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
      'docmost_update_page',
      'Update page metadata (title, icon, cover). For content updates, use docmost_update_page_markdown.',
      {
        pageId: z.string().describe('ID of the page to update'),
        title: z.string().optional().describe('New title for the page'),
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
      'Update an existing page using Markdown content. This preserves the page ID by using the native markdown update API.',
      {
        pageId: z.string().describe('ID of the page to update'),
        title: z.string().optional().describe('New title for the page'),
        content: z.string().describe('New content in Markdown format'),
        operation: z.enum(['replace', 'append', 'prepend']).optional().describe('How to apply the content: replace (default), append, or prepend'),
      },
      async (params) => {
        log(`update_page_markdown called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.updatePageMarkdown({
            pageId: params.pageId,
            content: params.content,
            title: params.title,
            operation: params.operation,
          });

          log(`Page updated successfully. Page ID preserved: ${params.pageId}`);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Page content updated (page ID preserved)',
                pageId: params.pageId,
                result
              }, null, 2)
            }],
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
      'Create a comment on a page. Content can be plain text (auto-converted to TipTap format) or TipTap JSON.',
      {
        pageId: z.string().describe('ID of the page to comment on'),
        content: z.union([z.string(), z.any()]).describe('Comment content - plain text or TipTap JSON object'),
        parentCommentId: z.string().optional().describe('ID of parent comment for replies'),
      },
      async (params) => {
        log(`create_comment called with: ${JSON.stringify(params)}`);
        try {
          // Convert string content to TipTap JSON format
          let content = params.content;
          if (typeof content === 'string') {
            content = {
              type: 'doc',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: content }]
              }]
            };
          }
          const result = await client.createComment({
            pageId: params.pageId,
            content,
            parentCommentId: params.parentCommentId,
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
      'Create a page with markdown or HTML content. Similar to docmost_create_page but also supports HTML format. Use docmost_create_page for markdown-only workflows.',
      {
        spaceId: z.string().describe('ID of the space to create the page in'),
        title: z.string().describe('Title of the page'),
        content: z.string().describe('Page content in markdown or HTML format'),
        format: z.enum(['markdown', 'html']).optional().describe('Content format (default: markdown)'),
        parentPageId: z.string().optional().describe('ID of the parent page for creating nested/child pages'),
      },
      async (params) => {
        log(`import_page called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.importPage(
            params.spaceId,
            params.title,
            params.content,
            params.format || 'markdown',
            params.parentPageId
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

    server.tool(
      'docmost_move_page',
      'Move a page to a new position in the page tree. Use to reorder pages or change parent.',
      {
        pageId: z.string().describe('ID of the page to move'),
        position: z.string().describe('New position string (5-12 characters, e.g., "a00001")'),
        after: z.string().optional().describe('ID of the page to place this page after'),
        before: z.string().optional().describe('ID of the page to place this page before'),
        parentPageId: z.string().optional().describe('New parent page ID (include to change parent, omit to keep current)'),
      },
      async (params) => {
        log(`move_page called with: ${JSON.stringify(params)}`);
        try {
          // Validate position string length (Docmost requires 5-12 characters)
          if (params.position.length < 5 || params.position.length > 12) {
            throw new Error('Position string must be 5-12 characters long');
          }

          const result = await client.movePage({
            pageId: params.pageId,
            position: params.position,
            after: params.after,
            before: params.before,
            parentPageId: params.parentPageId,
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

    // ==================== ATTACHMENT TOOLS ====================

    server.tool(
      'docmost_upload_attachment',
      'Upload an image or file to a Docmost page. Returns attachment URL for embedding.',
      {
        pageId: z.string().describe('ID of the page to attach to'),
        fileName: z.string().describe('Filename with extension (e.g., diagram.png)'),
        fileData: z.string().describe('Base64-encoded file content'),
        mimeType: z.string().optional().describe('MIME type (auto-detected if omitted)'),
      },
      async (params) => {
        log(`upload_attachment called with: pageId=${params.pageId}, fileName=${params.fileName}`);
        try {
          const result = await client.uploadAttachment(
            params.pageId,
            params.fileName,
            params.fileData,
            params.mimeType
          );

          const url = buildAttachmentUrl(result.id, result.fileName);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: result.id,
                fileName: result.fileName,
                fileSize: result.fileSize,
                mimeType: result.mimeType,
                url,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_get_attachment_info',
      'Get information about an attachment by ID',
      {
        attachmentId: z.string().describe('ID of the attachment'),
      },
      async (params) => {
        log(`get_attachment_info called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.getAttachmentInfo(params.attachmentId);
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
      'docmost_embed_image',
      'Upload an image and append/insert it into page content in one operation.',
      {
        pageId: z.string().describe('ID of the page'),
        fileName: z.string().describe('Filename with extension (e.g., diagram.png)'),
        fileData: z.string().describe('Base64-encoded file content'),
        altText: z.string().optional().describe('Alt text for the image'),
        position: z.enum(['append', 'prepend']).optional().describe('Where to insert (default: append)'),
      },
      async (params) => {
        log(`embed_image called with: pageId=${params.pageId}, fileName=${params.fileName}`);
        try {
          // 1. Upload attachment
          const attachment = await client.uploadAttachment(
            params.pageId,
            params.fileName,
            params.fileData
          );

          const url = buildAttachmentUrl(attachment.id, attachment.fileName);
          const markdown = buildMarkdownImage(url, params.altText);
          const position = params.position || 'append';

          // 2. Update page with markdown image
          await client.updatePageMarkdown({
            pageId: params.pageId,
            content: markdown,
            operation: position,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                attachmentId: attachment.id,
                url,
                pageUpdated: true,
                position,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_embed_from_cdn',
      'Embed an image from a CDN URL into a page. Two modes: (1) transfer=false (default): embeds CDN URL directly - fast but requires CDN access. (2) transfer=true: downloads from CDN and uploads to Docmost as attachment - image stored in Docmost, independent of CDN.',
      {
        pageId: z.string().describe('ID of the page'),
        cdnUrl: z.string().url().describe('Full CDN URL (e.g., https://cdn.khn.family/keep/diagram.png)'),
        altText: z.string().optional().describe('Alt text for the image'),
        position: z.enum(['append', 'prepend']).optional().describe('Where to insert (default: append)'),
        transfer: z.boolean().optional().describe('If true, download from CDN and upload to Docmost as attachment. If false (default), just link to CDN URL.'),
      },
      async (params) => {
        log(`embed_from_cdn called with: pageId=${params.pageId}, cdnUrl=${params.cdnUrl}, transfer=${params.transfer}`);
        try {
          // Validate URL is from trusted CDN domains
          const trustedDomains = [
            'cdn.khn.family',
            'cdn.the-hourglass-project.com',
            'cdn.komputa.io',
          ];

          const url = new URL(params.cdnUrl);
          if (!trustedDomains.includes(url.hostname)) {
            throw new Error(`URL must be from a trusted CDN domain: ${trustedDomains.join(', ')}`);
          }

          const position = params.position || 'append';
          let finalUrl = params.cdnUrl;
          let attachmentId: string | undefined;

          if (params.transfer) {
            // Transfer mode: download from CDN and upload to Docmost
            log(`Transferring image from CDN to Docmost...`);

            // Fetch image from CDN
            const axios = (await import('axios')).default;
            const response = await axios.get(params.cdnUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });

            // Convert to base64
            const base64Data = Buffer.from(response.data).toString('base64');

            // Extract filename from URL
            const pathParts = url.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1] || 'image.png';

            // Detect mime type from extension
            const ext = fileName.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'svg': 'image/svg+xml',
            };
            const mimeType = mimeTypes[ext || ''] || 'image/png';

            // Upload to Docmost as attachment
            const attachment = await client.uploadAttachment(
              params.pageId,
              fileName,
              base64Data,
              mimeType
            );

            attachmentId = attachment.id;
            finalUrl = buildAttachmentUrl(attachment.id, attachment.fileName);
            log(`Uploaded as attachment: ${attachmentId}`);
          }

          // Build markdown image
          const markdown = buildMarkdownImage(finalUrl, params.altText);

          // Update page with markdown image
          await client.updatePageMarkdown({
            pageId: params.pageId,
            content: markdown,
            operation: position,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                cdnUrl: params.cdnUrl,
                finalUrl,
                attachmentId,
                transferred: !!params.transfer,
                pageUpdated: true,
                position,
                markdownInserted: markdown,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_insert_drawio_block',
      'Insert a Draw.io diagram block into a page (enables native editing in Docmost)',
      {
        pageId: z.string().describe('ID of the page'),
        spaceId: z.string().describe('ID of the space containing the page'),
        diagramData: z.string().describe('.drawio XML content or SVG (base64 encoded)'),
        fileName: z.string().optional().describe('Filename (default: diagram.drawio.svg)'),
        position: z.enum(['append', 'prepend']).optional().describe('Where to insert (default: append)'),
      },
      async (params) => {
        log(`insert_drawio_block called with: pageId=${params.pageId}`);
        try {
          const fileName = params.fileName || 'diagram.drawio.svg';
          const position = params.position || 'append';

          // 1. Upload the diagram file as attachment
          const attachment = await client.uploadAttachment(
            params.pageId,
            fileName,
            params.diagramData,
            'image/svg+xml'
          );

          const url = buildAttachmentUrl(attachment.id, attachment.fileName);

          // 2. Build the drawio node
          const drawioNode = buildDrawioNode(attachment.id, url, fileName, 'center');

          // 3. Get current page content
          const currentContent = await client.getPageContent(params.pageId, params.spaceId);

          // 4. Insert node at position
          const newContent = position === 'prepend'
            ? prependNodeToDocument(currentContent, drawioNode)
            : appendNodeToDocument(currentContent, drawioNode);

          // 5. Update page with new content
          await client.updatePageContent(params.pageId, newContent);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                attachmentId: attachment.id,
                nodeType: 'drawio',
                inserted: true,
                position,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_insert_excalidraw_block',
      'Insert an Excalidraw diagram block into a page',
      {
        pageId: z.string().describe('ID of the page'),
        spaceId: z.string().describe('ID of the space containing the page'),
        diagramData: z.string().describe('Excalidraw JSON or SVG export (base64 encoded)'),
        fileName: z.string().optional().describe('Filename (default: sketch.excalidraw.svg)'),
        position: z.enum(['append', 'prepend']).optional().describe('Where to insert (default: append)'),
      },
      async (params) => {
        log(`insert_excalidraw_block called with: pageId=${params.pageId}`);
        try {
          const fileName = params.fileName || 'sketch.excalidraw.svg';
          const position = params.position || 'append';

          // 1. Upload the diagram file as attachment
          const attachment = await client.uploadAttachment(
            params.pageId,
            fileName,
            params.diagramData,
            'image/svg+xml'
          );

          const url = buildAttachmentUrl(attachment.id, attachment.fileName);

          // 2. Build the excalidraw node
          const excalidrawNode = buildExcalidrawNode(attachment.id, url, fileName, 'center');

          // 3. Get current page content
          const currentContent = await client.getPageContent(params.pageId, params.spaceId);

          // 4. Insert node at position
          const newContent = position === 'prepend'
            ? prependNodeToDocument(currentContent, excalidrawNode)
            : appendNodeToDocument(currentContent, excalidrawNode);

          // 5. Update page with new content
          await client.updatePageContent(params.pageId, newContent);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                attachmentId: attachment.id,
                nodeType: 'excalidraw',
                inserted: true,
                position,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_move_page_to_parent',
      'Move an existing page to a different parent page or to root level. Uses /api/pages/move endpoint.',
      {
        pageId: z.string().describe('ID of page to move'),
        parentPageId: z.string().optional().describe('New parent page ID (omit or null for root level)'),
        position: z.string().optional().describe('Position string (5-12 chars). Defaults to "a0000" (top of list)'),
      },
      async (params) => {
        log(`move_page_to_parent called with: ${JSON.stringify(params)}`);
        try {
          const result = await client.movePageToParent(
            params.pageId,
            params.parentPageId || null,
            params.position
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                pageId: params.pageId,
                newParentId: params.parentPageId || null,
                position: params.position || 'a0000',
                success: true,
                result,
              }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

    server.tool(
      'docmost_bulk_create_pages',
      'Create multiple pages in a single operation',
      {
        spaceId: z.string().describe('ID of the space'),
        pages: z.array(z.object({
          title: z.string().describe('Page title'),
          content: z.string().optional().describe('Page content in markdown'),
          parentPageId: z.string().optional().describe('Parent page ID for nested pages'),
        })).describe('Array of pages to create'),
      },
      async (params) => {
        log(`bulk_create_pages called with: ${params.pages.length} pages`);
        try {
          const created: Array<{ title: string; pageId: string }> = [];
          const failed: Array<{ title: string; error: string }> = [];

          for (const page of params.pages) {
            try {
              const result = await client.createPage({
                title: page.title,
                spaceId: params.spaceId,
                parentPageId: page.parentPageId,
                content: page.content,
                format: 'markdown',
              });
              created.push({ title: page.title, pageId: result.data?.id || result.id });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              failed.push({ title: page.title, error: msg });
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ created, failed }, null, 2)
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
      }
    );

  return server;
}

async function startServer() {
  try {
    // Authenticate with Docmost
    logger.info('Authenticating with Docmost...');
    await client.login();
    const user = await client.getCurrentUser();
    logger.info('Authenticated', { user: user.user?.name || user.user?.email || 'Unknown' });

    // Connect to MCP transport
    logger.info('Starting MCP server...', { httpMode, httpPort });

    if (httpMode) {
      // HTTP mode for Docker deployment
      // Store { transport, server } per session - each SSE connection needs its own Server
      const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();
      const sseSessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

      const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '/', `http://localhost:${httpPort}`);

        // Health check endpoint
        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy' }));
          return;
        }

        // SSE endpoint - create NEW server instance per connection
        if (url.pathname === '/sse' && req.method === 'GET') {
          logger.info('New SSE connection established');
          const transport = new SSEServerTransport('/messages', res);
          const sessionId = transport.sessionId;

          // Create a NEW server instance for this connection
          const sseServer = buildServer(client);

          sseSessions.set(sessionId, { transport, server: sseServer });
          transport.onclose = () => {
            logger.info('SSE connection closed', { sessionId });
            sseSessions.delete(sessionId);
          };
          await sseServer.connect(transport);
          return;
        }

        // SSE messages endpoint
        if (url.pathname === '/messages' && req.method === 'POST') {
          const sessionId = url.searchParams.get('sessionId');
          if (!sessionId || !sseSessions.has(sessionId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
            return;
          }
          const { transport } = sseSessions.get(sessionId)!;
          await transport.handlePostMessage(req, res);
          return;
        }

        if (url.pathname === '/mcp') {
          const sessionId = req.headers['mcp-session-id'] as string | undefined;

          if (req.method === 'POST') {
            let session = sessionId ? sessions.get(sessionId) : undefined;

            if (!session) {
              // Create NEW server instance for this connection
              const mcpServer = buildServer(client);

              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                  sessions.set(id, { transport, server: mcpServer });
                },
              });

              transport.onclose = () => {
                if (sessionId) sessions.delete(sessionId);
              };

              await mcpServer.connect(transport);
              session = { transport, server: mcpServer };
            }

            await session.transport.handleRequest(req, res);
            return;
          }

          if (req.method === 'GET' || req.method === 'DELETE') {
            if (!sessionId || !sessions.has(sessionId)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
              return;
            }

            const { transport } = sessions.get(sessionId)!;
            await transport.handleRequest(req, res);
            return;
          }
        }

        res.writeHead(404);
        res.end('Not found');
      });

      httpServer.listen(httpPort, '0.0.0.0', () => {
        logger.info('Docmost MCP HTTP server started', {
          port: httpPort,
          streamableEndpoint: `http://0.0.0.0:${httpPort}/mcp`,
          sseEndpoint: `http://0.0.0.0:${httpPort}/sse`,
          healthEndpoint: `http://0.0.0.0:${httpPort}/health`,
        });
      });
    } else {
      // STDIO mode for direct CLI usage (single connection, one server is fine)
      const stdioServer = buildServer(client);
      const transport = new StdioServerTransport();
      await stdioServer.connect(transport);
      logger.info('Docmost MCP server running (stdio mode)');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Fatal error', { error: msg });
    process.exit(1);
  }
}

// Export for bootstrap
export { startServer };

// Allow direct execution for backwards compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    logger.error('Failed to start MCP server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
