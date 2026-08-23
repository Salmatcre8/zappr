# zappr mobile

The zappr mobile app (iOS + Android) — Expo / React Native with expo-router.
Same product as the web app: **Nostr feed + Lightning wallet + multilingual AI
agent** on one screen, self-custodial, keys never leave the device.

## Repo structure decision (issue #5)

**Same repo, standalone app folder** (`mobile/`, self-contained `package.json`,
no workspace restructure):

- The web app stays untouched at the repo root, so the Vercel production deploy
  and its build settings are at **zero risk** — no `apps/web` move, no root
  `package.json` churn.
- One repo keeps mobile + web reviewable in one contribution stream, and shared
  logic was **ported file-for-file with identical shapes** (`WalletAdapter`,
  stores, nostr helpers, agent executor), so extracting `packages/core` later is
  a mechanical move, not a rewrite.
- Full monorepo tooling (workspaces/Turborepo) is deliberately deferred until
  the mobile app stabilizes — it can be revisited once #6/#7 force shared
  derivation code.

## Run it

```bash
cd mobile
npm install
npx expo start        # scan the QR with Expo Go (iOS/Android)
```

Environment (optional, defaults shown):

```bash
EXPO_PUBLIC_ZAPPR_API_BASE=https://www.usezappr.xyz   # agent + offramp API
EXPO_PUBLIC_DEFAULT_RELAYS=wss://relay.damus.io,...    # nostr relays
```

## What works in Expo Go today

| Area | Status |
|---|---|
| Shell per the mobile design reference: Login screen, tabs **Wallet · Feed · Agent**, Settings pushed from Wallet (#5) | ✅ |
| Nostr feed via NDK — global + follows, profiles, follow/unfollow, local-first follow cache (#8) | ✅ |
| Wallet via NWC (`@getalby/sdk`) — balance, receive (QR), send, tx list (#7, NWC path) | ✅ |
| AI agent chat against the deployed `/api/agent` — tool loop, confirm-before-send sheet, 429 handling (#9) | ✅ |
| Secure vault — device keystore + biometric gate, mode-aware logout (#10) | ✅ |
| nsec login (stored in vault, biometric unlock) | ✅ |
| Zap from feed (via connected wallet, LNURL-pay) | ✅ |

## What needs a development build (EAS) — not Expo Go

- **Breez SDK Liquid** (`@breeztech/react-native-breez-sdk-liquid`) — native
  module; also blocked on the #6 mnemonic-source decision. The
  `BreezAdapter` stub keeps the `WalletAdapter` surface compiled so screens
  don't change when it lands.
- **Passkey PRF onboarding** (#6) — `react-native-passkeys` needs a dev build;
  see the spike decision written up on issue #6. The vault already separates
  the session key from wallet-reconnect references so PRF can slot in.
- Biometric `requireAuthentication` on SecureStore items — unsupported in
  Expo Go; the vault soft-gates with `expo-local-authentication` instead
  (deliberate: hard-gating also invalidates entries when biometrics change,
  which is a fund-loss risk for a wallet mnemonic).

## Guardrails carried over from web

- **Keys never leave the device**; the server only proxies Claude.
- **Confirm-before-send** on every payment / zap / post — `ConfirmSheet` is
  the single chokepoint, used by both the agent and the wallet screens.
- **Mode-aware logout** — logout clears the signing key but keeps the
  wallet-reconnect reference (the web lockout bug, commit `3307703`, is
  explicitly guarded against in `src/lib/vault.ts`).

## Layout

```
src/
  app/            expo-router routes
    login.tsx     welcome / unlock / nsec login (cold-start screen)
    settings.tsx  identity, appearance, security, logout (pushed from Wallet)
    (tabs)/       Wallet (default) · Feed · Agent
  components/     Avatar, NoteRow, ChatMessage, ConfirmSheet, ConfirmCard,
                  BottomSheet, Toast
  lib/
    nostr/        NDK init, events, keys, local-first follow cache
    wallet/       WalletAdapter + NWC adapter + Breez stub + LNURL helpers
    agent/        /api/agent client, tool executor, confirm-tool list
    vault.ts      secure keystore vault (#10)
    session.ts    login / unlock / mode-aware logout
    theme.ts      zappr tokens from the mobile design reference (light + dark)
    polyfills.ts  crypto/TextEncoder/Buffer shims for Hermes
  store/          zustand stores (ported 1:1 from web) + toast store
  types/          shared shapes (ported 1:1 from web)
```

The UI matches the Claude mobile design reference ("Zappr Mobile Standalone"):
three tabs with Wallet first, a dedicated login screen, Settings as a pushed
screen, flat hairline feed rows with hue avatars and pill zap buttons, an
inline confirm-before-send card in the agent chat, bottom sheets for
receive/send/backup, and toast feedback.
