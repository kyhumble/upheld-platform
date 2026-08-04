# Email deliverability (keep Upheld mail out of junk)

## Production From address

```bash
EMAIL_FROM="Upheld <reports@getupheld.com>"
RESEND_API_KEY=re_...
PILOT_NOTIFY_EMAIL=ky@getupheld.com
```

`reports@getupheld.com` must be on a **Verified** domain in Resend.

## DNS (required)

In [Resend → Domains](https://resend.com/domains) for `getupheld.com` (or your send subdomain):

| Type | Purpose |
|------|---------|
| **DKIM** TXT | Signing — required |
| **SPF** TXT / MX | Authorize Resend to send |
| **DMARC** TXT (recommended) | e.g. `v=DMARC1; p=none; rua=mailto:ky@getupheld.com` |

All records must show **Verified** in Resend. Without DKIM/SPF alignment, Gmail/Outlook often put mail in **Junk**.

### After DNS changes

1. Resend → Verify DNS  
2. Wait up to 24–48h for provider reputation to settle  
3. Send a test from the app to a Gmail + Outlook + work mailbox  
4. If junk: open message → **Not junk / Report not spam** a few times (helps training)

## Outlook / Microsoft 365

- Add `reports@getupheld.com` to **Safe senders**  
- Or org admin: allowlist the Resend sending IPs/domain from Resend docs  

## Content rules (already applied in app)

- Transactional subjects (no “URGENT!!! FREE!!!” style)  
- Plain text + simple HTML multipart  
- Real physical-ish identity in footer (Humble Haus Ventures + contact)  
- Reply-To set to the human QA address when available  
- From always on `getupheld.com`, not `resend.dev`

## Diagnose

1. App shows **Email not delivered** → fix API key / domain first  
2. App shows **Sent** but nothing in inbox → check **Spam/Junk**, then [Resend → Emails](https://resend.com/emails) for delivered/bounced  
3. Resend shows **Delivered** but junk → DNS/DMARC + safe senders  

## Rotate keys

Never commit API keys. After rotation:

```bash
printf '%s' 're_NEW_KEY' | npx vercel env add RESEND_API_KEY production --force
npx vercel deploy --prod --yes
```
