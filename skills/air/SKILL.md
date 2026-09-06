---
name: air
description: Integrates AIR Kit — Partner JWT, JWKS, issuer DID, credential issue and verify, sandbox vs mainnet, air-issuer-service. Use when the user mentions AIR, AIR Kit, @mocanetwork/airkit, Partner ID, issuer DID, issueCredential, verifyCredential, JWKS, x-partner-auth, x-api-key, BUILD_ENV, or /air commands.
version: 0.1.0
user-invocable: true
argument-hint: "[init|provision|keys|register|account|schema|issue|verify|agent|audit|polish|document] [target]"
license: MIT
allowed-tools:
  - Bash(npx air-skill *)
  - Bash(node skills/air/scripts/*)
---

# AIR

One skill. Context travels with the repo in `PARTNER.md` and `AIR.md`. Commands change project state through scripts — do not invent curl.

## Setup

1. Run `node <skill-base-dir>/scripts/context.mjs` once per session from the user's project cwd. `<skill-base-dir>` is this skill folder. Fallback: `skills/air/scripts`.
2. If stdout starts with `NO_PARTNER_MD`, refuse other commands and follow [references/init.md](references/init.md).
3. Load **one** playbook from the Commands table. Load domain references only when that command needs them (`auth.md` for JWT/JWKS/401, `environments.md` for sandbox/mainnet).
4. After init writes the two context files, resume without rerunning `context.mjs`.

## Hard rules

Encode these. Do not rediscover them from docs every session.

- Partner ID comes from Dashboard → Account → General. Issuer DID is **not** handed out on login — it is derived from a 32-byte `SEED` and must be registered before Issuer/Verifier menus appear.
- Issue/verify stay blocked until a **public HTTPS JWKS** is live and registered. Localhost fails. JWT `kid` must exist in `keys[].kid`. Recommended JWT life is 5 minutes. Claims always include `partnerId`; issuance needs `scope: "issue"`. Private key is server-only.
- Sandbox is Testnet-only (`BUILD_ENV.SANDBOX`). Production is `BUILD_ENV.PRODUCTION` + `credentialNetwork: "mainnet"`. Credentials and programs do not travel across networks.
- Two auth planes: Partner JWT (`x-partner-auth`) for AIR APIs; `x-api-key` / `x-admin-api-key` for the self-hosted issuer. Bases: `https://api.sandbox.mocachain.org/v1` and production mainnet.
- After DID registration, never generate a new `SEED`. Hand AIR: Issuer DID, Partner ID, API key, public `ISSUER_ORIGIN` (`/credential-status/:nonce`, `/available-vc`, `/issue-vc`).

## Never do

- Generate a new `SEED` after the DID is registered
- Put Partner JWT signing in the browser
- Reuse one JWT across users or across issue + verify without the right scope
- Assume Testnet credentials exist on mainnet
- Call Privy directly for agentic wallets
- Store raw PII in `credentialSubject` when a bracket / boolean / enum works
- Skip JWKS because login already works — account login can succeed while issue/verify is dead
- Print full private keys or `SEED` after the first write. Write to `.env.local` and gitignore it
- Invent a Partner ID, schema ID, program ID, issuer DID, or API origin
- Set `credentialSubject.id` in a schema class (framework sets the holder DID)
- Prefix `SEED`, `PARTNER_PRIVATE_KEY`, `API_KEY`, or `ADMIN_API_KEY` with `NEXT_PUBLIC_`

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `init` | Setup | Interview once; write `PARTNER.md`, `AIR.md`, `.env.example` | [references/init.md](references/init.md) |
| `provision` | Setup | Local IDs into env / PARTNER.md. Remote create is Phase 2 stub | [references/init.md](references/init.md) |
| `keys` | Setup | Generate ES256 pair, JWKS, `kid` = Partner ID; print DID only | [references/init.md](references/init.md) |
| `register` | Setup | Checklist to send AIR for issuer activation | [references/register.md](references/register.md) |
| `account` | Build | Embed `AirService`, login, session, BYO auth | [references/account.md](references/account.md) |
| `schema` | Build | Design credential subject (no raw PII) | [references/schema.md](references/schema.md) |
| `issue` | Build | Fork `air-issuer-service` + write Next claim UI | [references/issue.md](references/issue.md) |
| `verify` | Build | Program + selective disclosure / SDK verify | [references/verify.md](references/verify.md) |
| `agent` | Build | Point at `air-agentic-wallet-skill`; do not copy it | [references/agent.md](references/agent.md) |
| `audit` | Harden | JWKS, kid, env split, network mismatch | [references/audit.md](references/audit.md) |
| `polish` | Harden | Errors, ONCHAIN polling, CORS, 5-min JWT refresh | [references/polish.md](references/polish.md) |
| `document` | Harden | Integration README from PARTNER.md + real env names | [references/document.md](references/document.md) |

Natural language maps to the same table. `/air fix issueCredential 401` → [references/issue.md](references/issue.md) + [references/auth.md](references/auth.md) + `detect.mjs`.

## Routing

No argument: load [references/routing.md](references/routing.md). **Never auto-run a command.** Recommend 2–3 next moves:

1. No `PARTNER.md` → init
2. Issuer role, no JWKS route → keys then audit
3. Keys present, issuer not activated → register
4. Activated, no issue call → issue
5. Issue exists, verify missing (role verifier/both) → verify
6. Code present → audit then polish

## Scripts

Run these. Do not invent replacements.

```bash
node <skill-base-dir>/scripts/context.mjs --json
node <skill-base-dir>/scripts/init.mjs --role issuer --partner-id <uuid>
node <skill-base-dir>/scripts/keys.mjs --env sandbox
node <skill-base-dir>/scripts/jwt.mjs --scope issue
node <skill-base-dir>/scripts/jwks.mjs emit --target .
node <skill-base-dir>/scripts/jwks.mjs --check https://<origin>/api/.well-known/jwks
node <skill-base-dir>/scripts/detect.mjs --json
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids
```

Or `npx air-skill <command>`.

Provisioning must take `--env sandbox|production`. After create, update PARTNER.md **IDs only**. Remote actions (`createPartner`, `registerJwksUrl`, `activateIssuer`) are stubs — tell the user to use the Dashboard and `/air register`.

## Domain references

Load only when needed:

- [references/auth.md](references/auth.md) — JWT claims, kid, JWKS, scopes
- [references/environments.md](references/environments.md) — sandbox vs mainnet
- [references/issuance.md](references/issuance.md) — issuer service, schemas, programs
- [references/verification.md](references/verification.md)
- [references/anti-patterns.md](references/anti-patterns.md)
- [references/api-map.md](references/api-map.md) — which header + which base URL

## Related

Install: `npx air-skill install` — checkbox of detected agents, then project vs global using those dests. Docs MCP: `https://docs.moca.network/mcp`. Static skill: `npx skills add https://docs.moca.network`. Agentic wallets: `npx skills add MocaNetwork/air-agentic-wallet-skill` — see [references/agent.md](references/agent.md).
