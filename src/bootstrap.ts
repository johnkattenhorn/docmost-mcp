#!/usr/bin/env node
/**
 * Bootstrap entry point for docmost-mcp
 *
 * This file initializes OpenTelemetry BEFORE any other modules are loaded.
 * This is necessary because with ES modules, all static imports are hoisted
 * and resolved before any code executes. By using dynamic import() after
 * initializing the SDK, we ensure HTTP instrumentation can patch the modules.
 */

// Initialize OpenTelemetry first - this must happen before ANY other imports
import { initObservability } from './utils/observability.js';
initObservability();

// Now dynamically import the main application
// This ensures http/https modules are instrumented before axios loads
const startApp = async () => {
  const { startServer } = await import('./index.js');
  await startServer();
};

startApp().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
