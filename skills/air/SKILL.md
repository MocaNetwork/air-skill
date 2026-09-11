---
name: air
description: Integrates AIR Kit — Partner JWT, JWKS, issuer DID, credential issue and verify, sandbox vs mainnet, air-issuer-service. Use when the user mentions AIR, AIR Kit, @mocanetwork/airkit, Partner ID, issuer DID, issueCredential, verifyCredential, JWKS, x-partner-auth, x-api-key, BUILD_ENV, or /air commands.
version: 0.1.0
user-invocable: true
argument-hint: "[init|provision|keys|issuer-did|register|account|schema|issue|verify|agent|audit|polish|document] [target]"
license: MIT
allowed-tools:
  - Bash(npx air-dev-skill *)
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

- Partner ID comes from Dashboard → Account → General. Issuer DID is **not** handed out on login — it is derived from a 32-byte `SEED` via the nest repl after the backend exists.
- Never ask the user for `ISSUER_ORIGIN`, `/available-vc`, `/issue-vc`, or the JWKS URL. The skill sets `ISSUER_ORIGIN=http://localhost:3000` for dev and replaces it with the tunnel origin in `/air issue`. Claim URLs are `${ISSUER_ORIGIN}/available-vc` and `${ISSUER_ORIGIN}/issue-vc`, filled into the register pack automatically. After the tunnel exists, guide the user to paste JWKS, Available VC API, and Issue VC API (optional) on the Dashboard page.
- Ask whether they need a database before starting Postgres. `migration:up` runs only when they chose a database. Clone `air-issuer-service` and `pnpm install` **before** generating or importing keys.
- Existing partners: import their `.env`. Never generate a new `SEED` for them.
- Issue/verify stay blocked until a **public HTTPS JWKS** is live and registered. Localhost fails. JWT `kid` must exist in `keys[].kid`. Recommended JWT life is 5 minutes. Claims always include `partnerId`; issuance needs `scope: "issue"`. Private key is server-only.
- Sandbox is Testnet-only (`BUILD_ENV.SANDBOX`). Production is `BUILD_ENV.PRODUCTION` + `credentialNetwork: "mainnet"`. Credentials and programs do not travel across networks.
- Two auth planes: Partner JWT (`x-partner-auth`) for AIR APIs; `x-api-key` / `x-admin-api-key` for the self-hosted issuer. Bases: `https://api.sandbox.mocachain.org/v1` and production mainnet.
- After DID registration, never generate a new `SEED`. The register pack the skill builds is: Issuer DID, Partner ID, API key, `${ISSUER_ORIGIN}/available-vc`, `${ISSUER_ORIGIN}/issue-vc`.

## Never do

- Generate a new `SEED` after the DID is registered
- Put Partner JWT signing in the browser
- Reuse one JWT across users or across issue + verify without the right scope
- Assume Testnet credentials exist on mainnet
- Call Privy directly for agentic wallets
- Store raw PII in `credentialSubject` when a bracket / boolean / enum works
- Skip JWKS because login already works — account login can succeed while issue/verify is dead
- Print full private keys or `SEED` after the first write. Write to `.env` / `.env.local` and gitignore them
- Invent a Partner ID, schema ID, program ID, issuer DID, or API origin
- Set `credentialSubject.id` in a schema class (framework sets the holder DID)
- Prefix `SEED`, `PARTNER_PRIVATE_KEY_DER`, `API_KEY`, or `ADMIN_API_KEY` with `NEXT_PUBLIC_`
- Ask the user to supply `ISSUER_ORIGIN` or claim URLs the skill must produce
- Start Postgres or run migrations unless they chose a database
- Generate keys before the issuer backend is cloned and installed

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `init` | Setup | Interview: role, existing?, Partner ID, auth, database, frontend. Write `PARTNER.md`, `AIR.md`, `.env.example` | [references/init.md](references/init.md) |
| `provision` | Setup | Local IDs into env / PARTNER.md. Remote create is Phase 2 stub | [references/init.md](references/init.md) |
| `keys` | Setup | Generate or `--import` existing env into `apps/backend/.env`; auto-extract issuer DID | [references/init.md](references/init.md) |
| `issuer-did` | Setup | Nest repl → `did:air:...` → PARTNER.md | [references/init.md](references/init.md) |
| `register` | Setup | Dashboard paste pack (JWKS, Available VC, Issue VC) + AIR activation email | [references/register.md](references/register.md) |
| `account` | Build | Embed `AirService`, login, session, BYO auth | [references/account.md](references/account.md) |
| `schema` | Build | Design credential subject (no raw PII) | [references/schema.md](references/schema.md) |
| `issue` | Build | Clone backend (`--install`); later Next / JWKS / tunnel | [references/issue.md](references/issue.md) |
| `verify` | Build | Program + selective disclosure / SDK verify | [references/verify.md](references/verify.md) |
| `agent` | Build | Point at `air-agentic-wallet-skill`; do not copy it | [references/agent.md](references/agent.md) |
| `audit` | Harden | JWKS, kid, env split, network mismatch | [references/audit.md](references/audit.md) |
| `polish` | Harden | Errors, ONCHAIN polling, CORS, 5-min JWT refresh | [references/polish.md](references/polish.md) |
| `document` | Harden | Integration README from PARTNER.md + real env names | [references/document.md](references/document.md) |

Natural language maps to the same table. `/air fix issueCredential 401` → [references/issue.md](references/issue.md) + [references/auth.md](references/auth.md) + `detect.mjs`.

## Routing

No argument: load [references/routing.md](references/routing.md). **Never auto-run a command.** Recommend 2–3 next moves:

1. No `PARTNER.md` → init
2. Issuer role, no backend clone → issue (`--clone-backend --install`)
3. Existing partner, no imported env → keys `--import`
4. Backend present, no keys → keys
5. Keys present, no issuer DID → issuer-did
6. DID present, issuer not activated → register
7. Activated, no issue call → issue
8. Issue exists, verify missing (role verifier/both) → verify
9. Code present → audit then polish

## Scripts

Run these. Do not invent replacements.

```bash
node <skill-base-dir>/scripts/context.mjs --json
node <skill-base-dir>/scripts/init.mjs --role issuer --partner-id <uuid> --db none --frontend none
node <skill-base-dir>/scripts/issue.mjs --clone-backend --yes --install --dir apps/backend
node <skill-base-dir>/scripts/keys.mjs --env sandbox
node <skill-base-dir>/scripts/keys.mjs --env sandbox --import path/to/.env
node <skill-base-dir>/scripts/issuer-did.mjs --backend apps/backend
node <skill-base-dir>/scripts/jwt.mjs --scope issue
node <skill-base-dir>/scripts/jwks.mjs emit --target .
node <skill-base-dir>/scripts/jwks.mjs --check https://<origin>/api/.well-known/jwks
node <skill-base-dir>/scripts/detect.mjs --json
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids
```

Or `npx air-dev-skill <command>`.

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

Install: `npx air-dev-skill install` — checkbox of detected agents, then project vs global using those dests. Docs MCP: `https://docs.moca.network/mcp`. Static skill: `npx skills add https://docs.moca.network`. Agentic wallets: `npx skills add MocaNetwork/air-agentic-wallet-skill` — see [references/agent.md](references/agent.md).
