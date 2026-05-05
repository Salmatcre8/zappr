# Deploying zappr to Vercel

This is the operational checklist. Do it once when first deploying, then again whenever you change `NEXT_PUBLIC_*` env vars (those are inlined at build time).

## 1. Connect the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → pick `Salmatcre8/zappr`
3. Framework: **Next.js** (auto-detected — leave as-is)
4. Root directory: **/** (default)
5. Build & Output: **leave at defaults**

## 2. Set environment variables

In **Settings → Environment Variables**, add these. Tick **Production**, **Preview**, **Development** for each.

| Name | Source | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic console | **Server-side**, never inlined. Powers `/api/agent`. |
| `NEXT_PUBLIC_BREEZ_API_KEY` | Email from Breez (the long base64 cert string) | Inlined at build time. Single line, no whitespace. |
| `NEXT_PUBLIC_APP_NAME` | `zappr` | Cosmetic. |
| `NEXT_PUBLIC_DEFAULT_RELAYS` | `wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net,wss://relay.yakihonne.com` | Comma-separated. |
| `MAVAPAY_BASE_URL` | `https://staging.api.mavapay.co/api/v1` | Staging while testing. Switch to prod before real users. |
| `MAVAPAY_API_KEY` | Your MavaPay key | **Server-side only**. Used by `/api/offramp/*`. |
| `MAVAPAY_WEBHOOK_SECRET` | `pay` for staging | Currently unused (we poll instead of webhook). |

## 3. Deploy

Click **Deploy**. First build takes ~3 minutes (WASM bundle).

## 4. Smoke test the live URL

In order, verify each works:

- [ ] Landing page (`/`) loads with no console errors
- [ ] `/login` shows the **Create with FaceID/Fingerprint** button (proves `NEXT_PUBLIC_BREEZ_API_KEY` is set)
- [ ] Tap that button → enroll a passkey → land on `/dashboard` with a Lightning balance (probably `0 sats`)
- [ ] Wallet sidebar → **Receive sats** → enter 100 sats → invoice + QR render
- [ ] Wallet sidebar → **Send sats** → opens form (don't actually send unless you have funds)
- [ ] Feed → paste an `npub` or use a suggested-follow chip → kind:3 publishes → notes appear after a few seconds
- [ ] Agent panel → ask "what's a BOLT11 invoice?" in Pidgin or Yoruba — replies in same language
- [ ] Agent panel → ask "send 5000 sats and pay 2000 naira to 8117312955 OPAY" → quote appears → confirm card has bank/account/sats summary

## Gotchas

**Passkeys are bound to the hostname.** A passkey enrolled on `localhost:3000` will not unlock at `zappr.vercel.app` — they're different origins per WebAuthn. Each domain (preview branches included) has its own passkey universe. For demos, enroll fresh on whichever URL you're showing.

**`NEXT_PUBLIC_*` changes need a redeploy**, not just a refresh. They're baked into the bundle at `next build` time. From the Vercel **Deployments** tab → ⋯ on latest → **Redeploy**.

**MavaPay staging auto-pays Lightning invoices.** This is a feature for testing — `POST /api/offramp/simulate` works only on staging. Do NOT call it in production; it's blocked by `isStaging()` guard but worth not relying on.

**WASM and serverless cold starts.** First Breez SDK call after a cold deploy takes ~3 seconds (loading the WASM module + connecting). Subsequent calls in the same browser session are instant.

## Custom domain (optional)

In **Settings → Domains** add `zappr.app` (or whatever). DNS: A record to `76.76.21.21` and AAAA / CNAME per Vercel's instructions. **Re-enroll passkeys on the custom domain** for the same reason as above — `*.vercel.app` and `zappr.app` are different origins.

## Rotation

If `ANTHROPIC_API_KEY` ever leaks (e.g. you accidentally pasted it in chat):
1. Revoke at https://console.anthropic.com → API Keys
2. Create new
3. Update both `.env.local` and Vercel env vars
4. Redeploy
