FROM node:20-alpine

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source to reduce image size
RUN rm -rf src/ tsconfig.json && npm prune --production

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Run the MCP server in HTTP mode
CMD ["node", "dist/index.js", "--http"]
