# Custom domain for Upheld platform

## Current setup

| Host | Vercel project | Notes |
|------|----------------|-------|
| **getupheld.com** / **www** | `upheld` | Marketing / brand site (keep) |
| **upheld-platform.vercel.app** | `upheld-platform` | This CRI product (Free Chart Scan) |

Do **not** point apex `getupheld.com` at `upheld-platform` unless you intentionally replace the marketing site.

## Recommended product hostname

```
app.getupheld.com  →  upheld-platform
```

### Steps

1. Vercel → **upheld-platform** → Settings → Domains → Add `app.getupheld.com`
2. If DNS is already on Vercel NS for `getupheld.com`, Vercel can auto-provision the subdomain.
3. Set production env:

```bash
NEXT_PUBLIC_APP_URL=https://app.getupheld.com
```

4. Redeploy so email links, Stripe success URLs, and sitemap use the new host.
5. Stripe Dashboard → update Checkout success/cancel base URL if needed.
6. Resend → verify domain for `reports@getupheld.com` (or similar).

### Optional

| Host | Use |
|------|-----|
| `scan.getupheld.com` | Alias redirect → `/scan` |
| `cri.getupheld.com` | Alternate brand subdomain |

## CLI (when ready)

```bash
cd /Users/kyhumble/upheld
npx vercel domains add app.getupheld.com
# then set NEXT_PUBLIC_APP_URL and redeploy
```
