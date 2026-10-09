# Burst-capable API deployment

This configuration puts Nginx in front of two independent API instances. It
absorbs connection bursts, reuses upstream connections, and routes a failed
instance to the healthy peer. It does not rate-limit by source IP because many
satellites can share a school, NAT, or cellular IP; the backend's per-satellite
Redis limit remains the authoritative rate limit.

## Deploy

1. Run Redis, MySQL, and exactly one telemetry worker as durable shared
   services. Use the configured Redis AOF volume and MySQL backups.
2. Run the same backend release on two hosts/containers, each with the same
   `TELEMETRY_REDIS_*`, `TELEMETRY_DB_*`, and fleet-key settings. Start only
   `node server.js` in these API instances.
3. Change the two `server` lines in [nginx.conf](./nginx.conf) to the private
   IP/DNS addresses of those API instances. Do not expose port 5000 publicly.
4. Run `nginx -t`, reload Nginx, and expose only HTTPS port 443 publicly.
5. Configure the load balancer/Nginx health check to call `/api/ready`, not
   `/api/health`. Remove an instance from rotation when readiness is `503`.

## Required observability

Alert on Nginx 5xx/connection errors, `/api/ready` failures, API p95 latency,
Redis memory above 80%, rejected Redis writes, stream pending count/age, worker
errors, MySQL pool waits, and failed backup jobs.

## Verification

Run the 2,400 RPS burst from a separate load-generator machine. Test one API
instance stopped, Redis stopped/restarted, and worker restarted. A successful
result requires no connection-refused errors, controlled `503` during a Redis
outage, and the worker draining all accepted packets into MySQL.
