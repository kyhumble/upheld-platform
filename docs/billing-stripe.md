# Stripe 30-day pilot checkout

## Env (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` |
| `STRIPE_PRICE_ID` | One-time Price for pilot package |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from Stripe Dashboard webhook |
| `NEXT_PUBLIC_STRIPE_PILOT_ENABLED` | Optional UI hint (`1`) — UI also checks secrets server-side |

## Stripe Dashboard

1. Create Product: **Upheld 30-day Pilot**
2. Add one-time Price (e.g. $2,500 or your pilot fee)
3. Copy Price ID → `STRIPE_PRICE_ID`
4. Webhook endpoint: `https://upheld-platform.vercel.app/api/billing/webhook`
5. Event: `checkout.session.completed`
6. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## App flow

1. Free Chart Scan report → **Request pilot** (creates `PilotLead` + emails)
2. Or **Start paid 30-day pilot** → `/api/billing/checkout` → Stripe Checkout
3. Success → `/pilot/success?session_id=…`
4. Webhook marks lead `paid` and agency `planTier=pilot` when `agencyId` present

## Ops export

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://upheld-platform.vercel.app/api/ops/pilot-leads.csv" -o leads.csv
```

Without Stripe keys, interest-only path remains fully functional.
