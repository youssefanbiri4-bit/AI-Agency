-- Allow read-only Google Ads and Pinterest provider connections.
-- Existing Meta rows stay intact; this only widens the provider check.

alter table public.ad_connections
  drop constraint if exists ad_connections_provider_check;

alter table public.ad_connections
  add constraint ad_connections_provider_check
  check (provider in ('meta', 'google_ads', 'pinterest'));
