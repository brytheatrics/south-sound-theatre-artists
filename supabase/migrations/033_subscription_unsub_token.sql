-- 033_subscription_unsub_token.sql
-- Add a per-row unsubscribe token so digest emails can include a
-- one-click unsubscribe link without round-tripping a magic-link
-- generator. Token is opaque (32 random bytes, base64url) and only
-- ever appears in outgoing emails - any leak is recoverable by
-- rotating the row.

alter table public.callboard_subscriptions
  add column if not exists unsubscribe_token text;

-- Backfill any pre-existing rows. New rows are populated by the
-- subscribe action, but this keeps things consistent if the column
-- gets added later in production.
update public.callboard_subscriptions
   set unsubscribe_token = encode(gen_random_bytes(24), 'base64')
 where unsubscribe_token is null;

create unique index if not exists callboard_subscriptions_unsub_token_idx
  on public.callboard_subscriptions (unsubscribe_token);
