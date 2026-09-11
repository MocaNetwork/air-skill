# /air register

Two registrations. They are frequently confused. Never ask the user to invent `ISSUER_ORIGIN` or the claim paths — read `ISSUER_ORIGIN` from `apps/backend/.env` and derive the URLs.

## Self-serve (user pastes what the skill computed)

Dashboard page, after the tunnel is up:

1. **JWKS URL** — `https://<web-tunnel>/api/.well-known/jwks`. Localhost fails.
2. **Available VC API** — `${ISSUER_ORIGIN}/available-vc`
3. **Issue VC API** (optional) — `${ISSUER_ORIGIN}/issue-vc`
4. **Domains** — whitelist the web origin.

Check the JWKS URL first:

```bash
node <skill-base-dir>/scripts/jwks.mjs --check https://<web-origin>/api/.well-known/jwks
```

## Manual (email the Moca Network / AIR team)

There is no self-serve field for the issuer backend API key. Send all four. Copy `API_KEY` from `apps/backend/.env` — do not print it in chat.

| Item | Source | Share? |
|---|---|---|
| Issuer DID | `PARTNER.md` (from `issuer-did.mjs` / nest repl) | yes |
| API key | `API_KEY` in `apps/backend/.env` — AIR sends it as `x-api-key` | yes |
| Partner ID | Dashboard UUID / `PARTNER.md` | yes |
| Issuer backend URLs | `${ISSUER_ORIGIN}/available-vc` and `${ISSUER_ORIGIN}/issue-vc` | yes |

Do **not** send `SEED`, `ADMIN_API_KEY`, or partner private keys.

Until AIR completes this, `/available-vc` and `/issue-vc` return **403** before any controller runs, or AIR never routes to you.

Issuer/Verifier menus stay hidden until the DID is registered.

## After the user confirms

```bash
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids --activated yes --jwks-registered yes
```

Then offer `/air issue` or `/air audit`.
