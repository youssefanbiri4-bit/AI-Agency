# Production Rate Limiting

AgentFlow AI currently uses the built-in in-memory rate-limit store for local
development and internal single-instance use.

For production with multiple Vercel instances, plug a persistent store into
`src/lib/rate-limit.ts` by implementing `RateLimitStore` and calling
`setRateLimitStore()` during server startup.

Recommended future environment variables:

- `RATE_LIMIT_STORE=upstash`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Keep the existing limits on expensive routes:

- Alex chat
- task execution
- AI Studio generation
- Creative Assets image generation
- Content Studio generation
- campaign generation
- manual scheduler run

Do not store prompts, responses, API keys, provider tokens, or raw payloads in
the rate-limit store. Store counters only.
