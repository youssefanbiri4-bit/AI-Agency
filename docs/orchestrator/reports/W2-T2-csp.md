# W2-T2: CSP Violation Endpoint Resolution

## Decision
**Chose Option B**: Removed `report-uri` and `report-to` directives from CSP configuration until the `/api/csp-violation` endpoint is properly implemented.

## Rationale
- The `/api/csp-violation` endpoint was referenced in `src/lib/security/content-security-policy.ts` but did not exist
- The production CSP in `next.config.ts` does not use these directives (it has its own hardcoded CSP)
- Implementing a secure violation endpoint requires proper logging, rate limiting, and validation
- Removing the directives is the simplest, safest fix that resolves the inconsistency

## Changes Made
1. Removed `report-uri /api/csp-violation` and `report-to csp-endpoint` from `src/lib/security/content-security-policy.ts`
2. Updated corresponding test in `tests/content-security-policy.test.ts`
3. Updated code comment to reflect the change

## Impact
- No functional impact: directives were not being used in production headers
- Fixes the missing endpoint reference
- Maintains all other security headers unchanged

## Future Work
When ready to implement violation monitoring:
1. Create `/api/csp-violation` endpoint with:
   - POST method support
   - CSP violation report parsing
   - Secure logging
   - Rate limiting
2. Add `Reporting-Endpoints` header
3. Re-add `report-uri` and `report-to` directives
4. Update `next.config.ts` to use the centralized CSP configuration