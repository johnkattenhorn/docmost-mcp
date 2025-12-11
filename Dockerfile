FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source files
COPY . .

# Build TypeScript
RUN pnpm run build

# Set environment
ENV NODE_ENV=production

# Run the MCP server
CMD ["node", "dist/index.js"]
