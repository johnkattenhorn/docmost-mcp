# Contributing to Docmost MCP

Thank you for your interest in contributing to the Docmost MCP server!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/docmost-mcp.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development mode (with auto-reload)
pnpm run dev
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
DOCMOST_URL=https://your-docmost-instance.com
DOCMOST_EMAIL=your-email@example.com
DOCMOST_PASSWORD=your-password
```

## Code Style

- We use TypeScript with strict mode
- Keep functions focused and well-named
- Add JSDoc comments for public APIs
- Follow existing patterns in the codebase

## Pull Requests

1. Update the README if you're adding new tools
2. Ensure `pnpm run build` passes
3. Write a clear PR description explaining your changes
4. Link any related issues

## Adding New Tools

When adding new MCP tools:

1. Add the tool definition in `src/index.ts`
2. Add any API methods to `src/client.ts`
3. Update the tool table in `README.md`
4. Test with Claude Code or another MCP client

## Reporting Issues

- Check existing issues first
- Include Docmost version if relevant
- Provide steps to reproduce
- Include error messages and logs

## Questions?

Open a GitHub issue for questions or discussion.
