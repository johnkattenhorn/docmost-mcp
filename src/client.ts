/**
 * Docmost API Client
 *
 * Connects to standard Docmost instances using JWT cookie authentication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface DocmostConfig {
  baseUrl: string;
  authToken?: string;
  email?: string;
  password?: string;
  // Authentik proxy authentication
  authentikUsername?: string;
  authentikToken?: string;
  debug?: boolean;
}

export class DocmostClient {
  private client: AxiosInstance;
  private config: DocmostConfig;
  private authToken: string | null = null;
  private workspaceId: string | null = null;

  constructor(config: DocmostConfig) {
    this.config = config;

    if (config.authToken) {
      this.authToken = config.authToken;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authentik Basic Auth if configured
    if (config.authentikUsername && config.authentikToken) {
      const basicAuth = Buffer.from(`${config.authentikUsername}:${config.authentikToken}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers,
      withCredentials: true,
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((reqConfig) => {
      if (this.authToken) {
        reqConfig.headers['Cookie'] = `authToken=${this.authToken}`;
      }
      return reqConfig;
    });

    // Add response interceptor for debugging
    if (config.debug) {
      this.client.interceptors.response.use(
        (response) => {
          console.error(`[DEBUG] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
          return response;
        },
        (error: AxiosError) => {
          console.error(`[DEBUG] Error: ${error.response?.status} - ${error.message}`);
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Login to Docmost and get auth token
   */
  async login(): Promise<void> {
    if (this.authToken) {
      // Already have a token, verify it works
      try {
        await this.getCurrentUser();
        return;
      } catch {
        // Token invalid, try to login
        if (!this.config.email || !this.config.password) {
          throw new Error('Auth token invalid and no credentials provided');
        }
      }
    }

    if (!this.config.email || !this.config.password) {
      throw new Error('Email and password required for login');
    }

    const response = await this.client.post('/api/auth/login', {
      email: this.config.email,
      password: this.config.password,
    });

    // Extract token from Set-Cookie header
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      for (const cookie of cookies) {
        const match = cookie.match(/authToken=([^;]+)/);
        if (match) {
          this.authToken = match[1];
          break;
        }
      }
    }

    if (!this.authToken && response.data?.token) {
      this.authToken = response.data.token;
    }

    if (!this.authToken) {
      throw new Error('Failed to get auth token from login response');
    }
  }

  /**
   * Get current user info and workspace
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.client.post('/api/users/me', {});
    if (response.data?.workspace?.id) {
      this.workspaceId = response.data.workspace.id;
    }
    return response.data;
  }

  /**
   * Get workspace ID (fetches if not cached)
   */
  async getWorkspaceId(): Promise<string> {
    if (!this.workspaceId) {
      await this.getCurrentUser();
    }
    if (!this.workspaceId) {
      throw new Error('Could not determine workspace ID');
    }
    return this.workspaceId;
  }

  // ==================== SPACES ====================

  async listSpaces(options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/spaces/', options || {});
    return response.data;
  }

  async getSpace(spaceId: string): Promise<any> {
    const response = await this.client.post('/api/spaces/info', { spaceId });
    return response.data;
  }

  async createSpace(data: { name: string; description?: string; slug?: string }): Promise<any> {
    const response = await this.client.post('/api/spaces/create', data);
    return response.data;
  }

  async updateSpace(data: { spaceId: string; name?: string; description?: string; slug?: string }): Promise<any> {
    const response = await this.client.post('/api/spaces/update', data);
    return response.data;
  }

  async deleteSpace(spaceId: string): Promise<any> {
    const response = await this.client.post('/api/spaces/delete', { spaceId });
    return response.data;
  }

  // ==================== PAGES ====================

  async getPage(pageId: string, spaceId: string): Promise<any> {
    const response = await this.client.post('/api/pages/info', { pageId, spaceId });
    return response.data;
  }

  async createPage(data: {
    title: string;
    spaceId: string;
    parentPageId?: string;
    content?: any;
  }): Promise<any> {
    const response = await this.client.post('/api/pages/create', data);
    return response.data;
  }

  async updatePage(data: {
    pageId: string;
    title?: string;
    content?: any;
    icon?: string;
    coverPhoto?: string;
  }): Promise<any> {
    const response = await this.client.post('/api/pages/update', data);
    return response.data;
  }

  async deletePage(pageId: string): Promise<any> {
    const response = await this.client.post('/api/pages/delete', { pageId });
    return response.data;
  }

  async getRecentPages(spaceId: string, options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/pages/recent', { spaceId, ...options });
    return response.data;
  }

  async getSidebarPages(spaceId: string, options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/pages/sidebar-pages', { spaceId, ...options });
    return response.data;
  }

  async movePage(data: { pageId: string; position: string; after?: string; before?: string }): Promise<any> {
    const response = await this.client.post('/api/pages/move', data);
    return response.data;
  }

  async movePageToSpace(data: { pageId: string; spaceId: string; targetSpaceId: string }): Promise<any> {
    const response = await this.client.post('/api/pages/move-to-space', data);
    return response.data;
  }

  async getPageBreadcrumbs(pageId: string): Promise<any> {
    const response = await this.client.post('/api/pages/breadcrumbs', { pageId });
    return response.data;
  }

  async getPageHistory(pageId: string, options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/pages/history', { pageId, ...options });
    return response.data;
  }

  // ==================== SEARCH ====================

  async search(query: string, spaceId: string): Promise<any> {
    const response = await this.client.post('/api/search', { query, spaceId });
    return response.data;
  }

  async searchSuggest(query: string): Promise<any> {
    const response = await this.client.post('/api/search/suggest', { query });
    return response.data;
  }

  // ==================== COMMENTS ====================

  async listComments(pageId: string, options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/comments/', { pageId, ...options });
    return response.data;
  }

  async createComment(data: { pageId: string; content: any; parentCommentId?: string }): Promise<any> {
    const response = await this.client.post('/api/comments/create', data);
    return response.data;
  }

  async updateComment(data: { commentId: string; content: any }): Promise<any> {
    const response = await this.client.post('/api/comments/update', data);
    return response.data;
  }

  async deleteComment(commentId: string): Promise<any> {
    const response = await this.client.post('/api/comments/delete', { commentId });
    return response.data;
  }

  // ==================== GROUPS ====================

  async listGroups(options?: { page?: number; limit?: number; query?: string }): Promise<any> {
    const response = await this.client.post('/api/groups/', options || {});
    return response.data;
  }

  async getGroup(groupId: string): Promise<any> {
    const response = await this.client.post('/api/groups/info', { groupId });
    return response.data;
  }

  async createGroup(data: { name: string; description?: string }): Promise<any> {
    const response = await this.client.post('/api/groups/create', data);
    return response.data;
  }

  async updateGroup(data: { groupId: string; name?: string; description?: string }): Promise<any> {
    const response = await this.client.post('/api/groups/update', data);
    return response.data;
  }

  async deleteGroup(groupId: string): Promise<any> {
    const response = await this.client.post('/api/groups/delete', { groupId });
    return response.data;
  }

  // ==================== WORKSPACE ====================

  async getWorkspace(): Promise<any> {
    const response = await this.client.post('/api/workspace/info', {});
    return response.data;
  }

  async getWorkspaceMembers(options?: { page?: number; limit?: number }): Promise<any> {
    const response = await this.client.post('/api/workspace/members', options || {});
    return response.data;
  }

  // ==================== EXPORT ====================

  async exportPage(pageId: string, format: 'html' | 'markdown' | 'pdf', includeChildren?: boolean): Promise<any> {
    const response = await this.client.post('/api/pages/export', {
      pageId,
      format,
      includeChildren
    });
    return response.data;
  }

  async exportSpace(spaceId: string, format: 'html' | 'markdown'): Promise<any> {
    const response = await this.client.post('/api/spaces/export', { spaceId, format });
    return response.data;
  }

  // ==================== IMPORT ====================

  /**
   * Import a page with markdown or HTML content
   * This properly initializes the page content so it shows up in the UI
   */
  async importPage(spaceId: string, title: string, content: string, format: 'markdown' | 'html' = 'markdown'): Promise<any> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();

    // Pattern to match H1 at start of content (will be stripped to avoid duplication)
    // Docmost displays the page title in the header, so we don't want H1 in content too
    const h1Pattern = format === 'markdown'
      ? new RegExp(`^#\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+`, 'i')
      : new RegExp(`^<h1[^>]*>\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h1>\\s*`, 'i');

    // Strip any leading H1 that matches the title to avoid duplication
    const contentWithoutTitle = content.trim().replace(h1Pattern, '');

    // Always add the title as H1 for import (Docmost uses it for the page title)
    const fileContent = format === 'markdown'
      ? `# ${title}\n\n${contentWithoutTitle}`
      : `<h1>${title}</h1>\n${contentWithoutTitle}`;

    const extension = format === 'markdown' ? '.md' : '.html';
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;

    form.append('file', Buffer.from(fileContent), {
      filename,
      contentType: format === 'markdown' ? 'text/markdown' : 'text/html',
    });
    form.append('spaceId', spaceId);

    const response = await this.client.post('/api/pages/import', form, {
      headers: {
        ...form.getHeaders(),
        'Cookie': this.authToken ? `authToken=${this.authToken}` : '',
      },
    });

    return response.data;
  }
}
