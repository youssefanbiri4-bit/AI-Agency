# W9-INT-T1-REPORT — Circuit Breaker Integration

## Summary
Integrated `withCircuitBreaker()` into all 6 external provider modules, wrapping every outbound `fetch()` call. Added missing default configs for `META_API` and `PINTEREST`. Added OPEN/HALF_OPEN logging via `onOpen`/`onHalfOpen` callbacks on all default configs.

## Files Modified

### 1. `src/lib/circuit-breaker.ts`
- Added `logger` import
- Added `createDefaultConfig()` helper with built-in `onOpen`/`onHalfOpen` logging callbacks
- Added `META_API` and `PINTEREST` default configs
- All 6 default configs now log on state transitions

### 2. `src/lib/ai/text-provider.ts`
- Wrapped `fetch(OPENAI_CHAT_ENDPOINT, ...)` with `withCircuitBreaker(CIRCUIT_BREAKER_PROVIDERS.OPENAI_TEXT, ...)`

### 3. `src/lib/ai/openai-images.ts`
- Wrapped `fetch(OPENAI_IMAGE_ENDPOINT, ...)` with `withCircuitBreaker(CIRCUIT_BREAKER_PROVIDERS.OPENAI_IMAGE, ...)`

### 4. `src/lib/n8n.ts`
- Wrapped `safeFetch(webhookUrl, ...)` inside `executeN8nWorkflow()` with `withCircuitBreaker(CIRCUIT_BREAKER_PROVIDERS.N8N, ...)`

### 5. `src/lib/ads/google-ads.ts`
- Wrapped 3 fetch calls:
  - `fetch(GOOGLE_OAUTH_TOKEN_URL, ...)` → `GOOGLE_ADS` provider
  - `fetch(buildGoogleAdsApiUrl('/customers:listAccessibleCustomers'), ...)` → `GOOGLE_ADS_API`
  - `fetch(buildGoogleAdsApiUrl('/customers/.../googleAds:searchStream'), ...)` → `GOOGLE_ADS_API`

### 6. `src/lib/ads/google-ads-publishing.ts`
- Wrapped 2 fetch calls:
  - `listAccessibleCustomers()` → `GOOGLE_ADS_API`
  - Mutate POST → `GOOGLE_ADS_API`

### 7. `src/lib/ads/meta.ts`
- Wrapped 5 fetch calls:
  - `fetchMetaToken()` → `META_API`
  - `getMetaTokenDebugInfo()` → `META_API`
  - `fetchMetaAdAccounts()` → `META_API`
  - `fetchMetaCampaigns()` → `META_API`
  - `fetchMetaCampaignInsights()` → `META_API`

### 8. `src/lib/ads/meta-publishing.ts`
- Wrapped 2 fetch calls:
  - `fetchMetaPages()` → `META_API`
  - `postMetaGraph()` → `META_API`

### 9. `src/lib/ads/pinterest-publishing.ts`
- Wrapped 3 fetch calls:
  - `callPinterestApi()` → `PINTEREST`
  - `refreshPinterestAccessToken()` → `PINTEREST`
  - `exchangePinterestCodeForTokens()` → `PINTEREST`

## Integration Pattern
Every integration follows the same pattern:
```typescript
const response = await withCircuitBreaker(
  CIRCUIT_BREAKER_PROVIDERS.PROVIDER_NAME,
  () => fetch(url, { ... }),
  { timeoutMs: config.timeoutMs }
);
```

- **Backward compatible**: `withCircuitBreaker` returns the same `Response` type from fetch
- **Existing error handling preserved**: `CircuitBreakerOpenError` is caught by existing `catch` blocks, returning proper error responses
- **No API changes**: All function signatures, exports, props remain identical

## Circuit Configurations
| Provider | Failure Threshold | Cooldown | Timeout | Success Threshold |
|----------|:-----------------:|:--------:|:-------:|:-----------------:|
| OpenAI Text | 5 | 30s | 35s | 3 |
| OpenAI Image | 3 | 60s | 60s | 2 |
| Google Ads OAuth | 5 | 30s | 15s | 3 |
| Google Ads API | 5 | 30s | 15s | 3 |
| Meta API | 5 | 30s | 15s | 3 |
| Pinterest | 5 | 30s | 15s | 3 |
| n8n | 5 | 20s | 10s | 2 |

All configurations log to `circuit-breaker` child logger on OPEN (`warn`) and HALF_OPEN (`info`) transitions.

## Remaining Issues
- **n8n callback route** (`src/app/api/n8n/callback/route.ts`): Inbound webhook — no outbound `fetch()` calls to wrap
- **Buffer size**: The circuit breaker uses `InMemoryCircuitBreakerStore` by default — state is lost on process restart (acceptable for current scope)

## Status
✅ **Complete**
