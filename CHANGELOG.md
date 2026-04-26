# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-26

### Added
- Initial public release
- 32 MCP tools for Docmost integration
- Space management (list, create, update, delete)
- Page operations (CRUD, move, history, bulk create)
- Markdown content updates with append/prepend/replace modes
- Native Draw.io and Excalidraw diagram block insertion
- CDN-based image and diagram embedding
- Comment support (list, create, delete)
- Search and search suggestions
- Page export (HTML, Markdown, PDF)
- Attachment upload and management
- OpenTelemetry observability (traces, logs, metrics)
- Docker deployment support
- STDIO and HTTP transport modes

### Fixed
- Block insertion now preserves existing page content
- parentPageId properly honored on page creation
- Comment creation with proper JSON stringification
