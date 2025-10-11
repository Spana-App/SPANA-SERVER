// monitoring.js
const promClient = require('prom-client');

function setupMonitoring(app: any) {
  // Enable collection of default metrics
  promClient.collectDefaultMetrics();

  // Create custom metrics
  const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 5, 15, 50, 100, 300, 500, 1000, 3000, 5000]
  });

  // Metrics middleware
  app.use((req: any, res: any, next: any) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
      end({ method: req.method, route: req.route?.path || req.url, code: res.statusCode });
    });
    next();
  });

  // Metrics endpoint
  app.get('/metrics', async (req: any, res: any) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
}

module.exports = setupMonitoring;

export {};