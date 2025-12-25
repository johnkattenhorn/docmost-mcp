/**
 * Comprehensive OpenTelemetry Observability for MCP Servers
 *
 * Features:
 * - Distributed Tracing (to SigNoz)
 * - Structured Logging (console + OTLP HTTP)
 * - Metrics (request counts, durations, errors)
 *
 * Environment variables:
 * - OTEL_ENABLED: Enable/disable observability (default: false)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: SigNoz collector endpoint (default: http://192.168.1.93:4318)
 * - OTEL_SERVICE_NAME: Service name (default: docmost-mcp)
 * - LOG_LEVEL: Minimum log level (default: info)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import type { IncomingMessage, ClientRequest, ServerResponse } from 'http';

// Configuration
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://192.168.1.93:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'docmost-mcp';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SEVERITY_MAP: Record<LogLevel, { number: number; text: string }> = {
  debug: { number: 5, text: 'DEBUG' },
  info: { number: 9, text: 'INFO' },
  warn: { number: 13, text: 'WARN' },
  error: { number: 17, text: 'ERROR' },
};

// Metrics counters (simple in-memory)
const metrics = {
  requestCount: 0,
  errorCount: 0,
  requestDurations: [] as number[],
};

let sdk: NodeSDK | null = null;

/**
 * Send log to OTEL collector via HTTP
 */
async function sendOtelLog(
  level: LogLevel,
  message: string,
  attributes: Record<string, unknown> = {}
): Promise<void> {
  if (!OTEL_ENABLED) return;

  try {
    const now = Date.now();
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: SERVICE_NAME } },
              { key: 'service.version', value: { stringValue: SERVICE_VERSION } },
            ],
          },
          scopeLogs: [
            {
              scope: { name: SERVICE_NAME, version: SERVICE_VERSION },
              logRecords: [
                {
                  timeUnixNano: String(now * 1000000),
                  severityNumber: SEVERITY_MAP[level].number,
                  severityText: SEVERITY_MAP[level].text,
                  body: { stringValue: message },
                  attributes: Object.entries(attributes).map(([key, value]) => ({
                    key,
                    value: { stringValue: String(value) },
                  })),
                },
              ],
            },
          ],
        },
      ],
    };

    // Fire and forget - don't await to avoid blocking
    fetch(`${OTEL_ENDPOINT}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore OTEL logging errors
    });
  } catch {
    // Silently ignore OTEL logging errors
  }
}

/**
 * Initialize the full observability stack
 */
export function initObservability(): void {
  if (!OTEL_ENABLED) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'OpenTelemetry observability disabled',
      service: SERVICE_NAME,
    }));
    return;
  }

  try {
    // Initialize Trace Exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
    });

    // Initialize SDK with tracing
    sdk = new NodeSDK({
      serviceName: SERVICE_NAME,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span: Span, request: ClientRequest | IncomingMessage) => {
              if ('method' in request && 'path' in request) {
                const clientReq = request as ClientRequest;
                span.setAttribute('http.request.method', clientReq.method || 'UNKNOWN');
                span.setAttribute('http.url.path', clientReq.path || '/');
                span.setAttribute('http.host', clientReq.host || 'unknown');

                // Identify Docmost API calls
                if (clientReq.host?.includes('docmost') || clientReq.path?.includes('/api/')) {
                  span.setAttribute('docmost.api.call', true);
                }
              }
            },
            responseHook: (span: Span, response: IncomingMessage | ServerResponse) => {
              if (response.statusCode) {
                span.setAttribute('http.response.status_code', response.statusCode);
              }
            },
          },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    });

    sdk.start();

    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'OpenTelemetry observability initialized',
      endpoint: OTEL_ENDPOINT,
      serviceName: SERVICE_NAME,
      features: ['traces', 'logs', 'metrics'],
    }));

    // Graceful shutdown
    const shutdown = async () => {
      try {
        await sdk?.shutdown();
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'OpenTelemetry shut down gracefully',
        }));
      } catch (err) {
        console.error('OpenTelemetry shutdown error:', err);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Failed to initialize OpenTelemetry',
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

/**
 * Get the tracer for manual instrumentation
 */
export function getTracer() {
  return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
}

/**
 * Structured logger that sends to both console and SigNoz
 */
export const logger = {
  _log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      service: SERVICE_NAME,
      ...meta,
    };

    // Always log to stderr (MCP convention)
    console.error(JSON.stringify(logData));

    // Send to SigNoz if enabled
    sendOtelLog(level, message, { ...meta, timestamp });
  },

  debug(message: string, meta?: Record<string, unknown>) {
    this._log('debug', message, meta);
  },

  info(message: string, meta?: Record<string, unknown>) {
    this._log('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>) {
    this._log('warn', message, meta);
  },

  error(message: string, meta?: Record<string, unknown>) {
    this._log('error', message, meta);
    metrics.errorCount++;
  },
};

/**
 * Wrap an async function with a span for tracing
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const startTime = Date.now();
  metrics.requestCount++;

  const noopSpan = {
    setAttribute: () => noopSpan,
    setAttributes: () => noopSpan,
    setStatus: () => noopSpan,
    recordException: () => {},
    end: () => {},
    addEvent: () => noopSpan,
  } as unknown as Span;

  if (!OTEL_ENABLED) {
    try {
      const result = await fn(noopSpan);
      metrics.requestDurations.push(Date.now() - startTime);
      return result;
    } catch (error) {
      metrics.errorCount++;
      throw error;
    }
  }

  try {
    const tracer = getTracer();
    return await tracer.startActiveSpan(name, async (span) => {
      if (attributes) {
        span.setAttributes(attributes);
      }

      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        metrics.requestDurations.push(Date.now() - startTime);
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        metrics.errorCount++;
        throw error;
      } finally {
        span.end();
      }
    });
  } catch (tracingError) {
    logger.warn('Tracing failed, running without span', { error: String(tracingError) });
    try {
      const result = await fn(noopSpan);
      metrics.requestDurations.push(Date.now() - startTime);
      return result;
    } catch (error) {
      metrics.errorCount++;
      throw error;
    }
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetrics() {
  const durations = metrics.requestDurations;
  return {
    requestCount: metrics.requestCount,
    errorCount: metrics.errorCount,
    errorRate: metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0,
    avgDurationMs: durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0,
    p95DurationMs: durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] || 0
      : 0,
  };
}

export default {
  initObservability,
  getTracer,
  logger,
  withSpan,
  getMetrics,
};
