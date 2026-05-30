import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Counter, Gauge, Histogram } from 'prom-client';
import { config } from '../config.js';

// Generic HTTP metrics in the same shape the Grafana platform-overview dashboard
// queries (http_requests_total / http_request_duration_seconds). The `service`
// label lets a single Prometheus query aggregate across Node and Django services.
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests, labelled by service, method, route and status.',
  labelNames: ['service', 'method', 'route', 'status'] as const,
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['service', 'method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'In-flight HTTP connections currently being served.',
  labelNames: ['service'] as const,
});

const bandwidthBytesTotal = new Counter({
  name: 'bandwidth_bytes_total',
  help: 'Total response bytes served to viewers, labelled by user tier.',
  labelNames: ['service', 'user_tier'] as const,
});

const startTimes = new WeakMap<FastifyRequest, bigint>();

// Use the matched route template (e.g. /api/v1/stream/:videoId/manifest) rather
// than the raw URL so cardinality stays bounded by routes, not videoIds.
function routeLabel(req: FastifyRequest): string {
  return req.routeOptions?.url ?? req.url.split('?')[0] ?? 'unknown';
}

export function registerMetrics(app: FastifyInstance): void {
  const service = config.SERVICE_NAME;

  app.addHook('onRequest', async (req: FastifyRequest) => {
    startTimes.set(req, process.hrtime.bigint());
    activeConnections.inc({ service });
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    activeConnections.dec({ service });

    // Never record the scrape endpoint itself.
    if (req.url === '/metrics') return;

    const labels = {
      service,
      method: req.method,
      route: routeLabel(req),
      status: String(reply.statusCode),
    };
    httpRequestsTotal.inc(labels);

    const start = startTimes.get(req);
    if (start !== undefined) {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestDuration.observe(labels, seconds);
    }

    const sent = Number(reply.getHeader('content-length') ?? 0);
    if (sent > 0) {
      const tier = (req.headers['x-user-tier'] as string | undefined) ?? 'guest';
      bandwidthBytesTotal.inc({ service, user_tier: tier }, sent);
    }
  });
}
