-- Migration: Drop payment-related tables and clean subscriptions table
-- Internal platform — no payment processing needed

-- Drop payment-specific tables
DROP TABLE IF EXISTS public.billing_customers CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;

-- Clean up stripe columns from subscriptions (keep table for plan tracking)
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_price_id;
