# ⚡ zappr

> **Bitcoin you can talk to, in the language you think in.**

zappr is a self-custodial Bitcoin social + payments hub that unifies your Nostr feed, Lightning wallet, and an AI agent on a single screen — in any language.

Built for **Hack4Freedom Lagos 2026**.

---

## What it does

| Feature | Detail |
|---|---|
| **Nostr feed** | Reads your social graph, renders notes in real time via NDK |
| **Lightning wallet** | Connect any NWC-compatible wallet (Alby, Mutiny, Primal) |
| **AI agent** | Ask about balance, zap posts, send payments, post notes — in English, Pidgin, Yoruba, Hausa, Swahili, and more |
| **Self-custodial** | Your nsec never leaves the browser. No server holds your keys |
| **Biometric vault** | WebAuthn PRF + AES-GCM encrypts your nsec in IndexedDB. Fingerprint/Face ID unlocks it |
| **Three login paths** | Biometric vault · NIP-07 extension · direct nsec |

---

## Demo flows

```
User (Pidgin): "abeg check my balance"
zappr:          "You get 42,069 sats for your wallet."

User (Yoruba):  "kí ni zap?"
zappr:          "Zap jẹ́ ọ̀nà tí o fi ń fún ẹnìkan ní sats lórí Nostr — bí 'tip'."

User (English): "zap @jack 500 sats"
zappr:          [shows confirm card] "Send 500 sats to @jack?"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  Nostr   │  │ Lightning│  │       AI Agent           │  │
│  │  Feed    │  │ Wallet   │  │  (chat + tool loop)      │  │
│  └────┬─────┘  └────┬─────┘  └────────────┬─────────────┘  │
│       │              │                     │                │
│  ┌────▼──────────────▼─────────────────────▼─────────────┐ │
│  │              Zustand Stores                           │ │
│  │  useNostrStore · useWalletStore · useAgentStore       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────┐  ┌─────────────────────┐ │
│  │        Auth Layer            │  │   Client Executor   │ │
│  │  sessionStorage (tab-scoped) │  │  runs tools locally │ │
│  │  IndexedDB vault (encrypted) │  │  (balance, feed...) │ │
│  │  WebAuthn PRF (key derivation│  └─────────────────────┘ │
│  └──────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    POST /api/agent
                    (messages array)
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     NEXT.JS SERVER                          │
│                                                             │
│           /api/agent  →  Anthropic Claude API               │
│           (only Claude calls happen server-side)            │
│           ANTHROPIC_API_KEY lives here only                 │
└─────────────────────────────────────────────────────────────┘
```

### Data flow: AI tool loop

```
User types message
      │
      ▼
POST /api/agent  (messages[])
      │
      ▼
Claude returns  ──► text?  → render to chat
                ──► tool_use?
                        │
                        ▼
               clientExecutor.ts
               reads Zustand stores
               executes locally:
                 · get_wallet_balance → getBalanceSats()
                 · get_feed_summary  → fetchFeed()
                 · send_payment      → payInvoice()    ← requires user confirm
                 · zap_note          → zapNote()       ← requires user confirm
                 · post_note         → publishNote()   ← requires user confirm
                        │
                        ▼
               tool_result appended to messages[]
                        │
                        ▼
               POST /api/agent again (loop)
```

### Auth layer

```
On login:
  1. Biometric vault enrolled?
       YES → unlockVault() [WebAuthn get() + PRF → AES-GCM decrypt]
       NO  → check sessionStorage
               nsec found?  → rehydrate NDK with nsec
               useNip07?    → rehydrate NDK with NIP-07 signer
               nothing?     → redirect /login

After nsec login:
  BiometricSetupBanner appears on dashboard
  User clicks "Set up" →
    enrollVault({ nsec, nwc })     [WebAuthn create() + PRF → AES-GCM encrypt → IndexedDB]
    clearSession()                  [wipe sessionStorage — vault is now sole source of truth]

On logout:
  clearSession() + vaultClear() + resetNostr() + resetWallet() → /login
```

### Key derivation (biometric vault)

```
WebAuthn PRF output (32 bytes)
         │
         ▼
   HKDF-SHA256 (info: "zappr-vault-v1")
         │
         ▼
   AES-256-GCM key
         │
         ▼
   encrypt({ nsec, nwc })  →  stored in IndexedDB
```

---

## File structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── login/page.tsx            # Login page
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx              # Dashboard shell + session rehydration
│   └── api/
│       └── agent/route.ts        # Claude API proxy (server-side only)
│
├── components/
│   ├── auth/
│   │   ├── LoginPanel.tsx        # Three-path login (biometric/NIP-07/nsec)
│   │   └── BiometricSetupBanner.tsx  # Post-login vault enrollment prompt
│   ├── feed/
│   │   ├── UnifiedFeed.tsx       # Nostr feed container
│   │   ├── NoteCard.tsx          # Individual note renderer
│   │   └── ZapButton.tsx         # Inline zap control
│   ├── wallet/
│   │   ├── WalletPanel.tsx       # Balance + transaction history
│   │   └── ConnectWallet.tsx     # NWC connection form
│   ├── agent/
│   │   ├── AgentChat.tsx         # Tool loop orchestrator
│   │   ├── AgentInput.tsx        # Chat input
│   │   └── AgentMessage.tsx      # Message + confirmation card renderer
│   └── layout/
│       ├── TopBar.tsx            # Header with logout
│       ├── Sidebar.tsx           # Wallet panel (desktop left)
│       ├── RightPanel.tsx        # Agent panel (desktop right)
│       └── ThemeToggle.tsx       # Light/dark toggle
│
├── lib/
│   ├── nostr/
│   │   ├── ndk.ts                # NDK singleton (nsec or NIP-07 signer)
│   │   ├── keys.ts               # nsec → hex/npub derivation
│   │   └── events.ts             # fetchFollowList, fetchFeed, publishNote
│   ├── wallet/
│   │   ├── nwc.ts                # NWC provider init via Alby SDK
│   │   └── lightning.ts          # balance, pay, invoice, lnAddress→invoice
│   ├── agent/
│   │   ├── tools.ts              # Anthropic tool schemas
│   │   ├── clientExecutor.ts     # Tool dispatcher (runs locally in browser)
│   │   └── systemPrompt.ts       # Agent persona + language instructions
│   └── auth/
│       ├── session.ts            # sessionStorage read/write/clear
│       ├── vault.ts              # IndexedDB read/write/clear
│       ├── crypto.ts             # HKDF + AES-GCM
│       └── webauthn.ts           # enrollVault, unlockVault (PRF)
│
└── store/
    ├── useNostrStore.ts          # NDK instance, pubkey, npub
    ├── useWalletStore.ts         # NWC provider, balance
    └── useAgentStore.ts          # Chat message history
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS — neobrutalist theme |
| Nostr | `@nostr-dev-kit/ndk` 2.10.7 |
| Lightning | `@getalby/sdk` 3.7.1 (NWC) |
| AI | `@anthropic-ai/sdk` 0.39.0 — Claude Sonnet 4.6 |
| State | Zustand 4.5.4 |
| Auth | WebAuthn PRF + IndexedDB + sessionStorage |
| Icons | lucide-react |

---

## Environment variables

Only **one** environment variable is required:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Everything else (Nostr keys, NWC connection string) stays in the browser and is never sent to the server.

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**To test the full flow:**
1. Get a Nostr key from [getalby.com](https://getalby.com) or generate one with `nak keygen`
2. Get an NWC connection string from Alby, Mutiny, or Primal (optional)
3. Log in with your nsec → the AI agent can immediately check your balance and feed

---

## Design system

Neobrutalist — hard edges, no rounded corners, bold shadows.

| Token | Value | Use |
|---|---|---|
| `orange` | `#F7931A` | Bitcoin orange — primary actions |
| `volt` | `#FFE500` | Electric yellow — highlights, confirmations |
| `ink` | `#0A0A0A` | Near-black — always used for text on accents |
| `bone` | `#F5F5F0` (dark) / `#0A0A0A` (light) | Body text |
| Shadow | `4px 4px 0 0 #000` | All interactive cards |
| Border | `2px solid black` | All panels and inputs |
| Heading font | Space Mono | |
| Body font | Space Grotesk | |

---

## Supported languages (AI agent)

The agent detects and replies in any language the user writes in. Explicitly supported:

English · Nigerian Pidgin · Yoruba · Igbo · Hausa · Swahili · Amharic · Zulu · Xhosa · Twi · Ga · Wolof · Lingala · Shona · Somali · Oromo · Kinyarwanda · Fula

Bitcoin/Lightning terms (`sats`, `zap`, `npub`, `invoice`, `NWC`) are kept in their original form regardless of the reply language.

---

## License

MIT
