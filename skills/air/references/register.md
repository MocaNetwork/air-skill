# /air register

Two registrations. They are frequently confused.

## Self-serve (user does this)

1. Dashboard → Account → General → **JWKS URL**. Paste the full public HTTPS URL the app serves, e.g. `https://<web-tunnel>/api/.well-known/jwks`. Localhost fails.
2. Dashboard → **Domains**. Whitelist the web origin.

Check the URL first:

```bash
node <skill-base-dir>/scripts/jwks.mjs --check https://<web-origin>/api/.well-known/jwks
```

## Manual (email the Moca Network / AIR team)

There is no self-serve field for the issuer backend API key. Send all four:

| Item | Source | Share? |
|---|---|---|
| Issuer DID | `GET ${ISSUER_ORIGIN}/.well-known/issuer-did` | yes |
| API key | backend `API_KEY` — AIR sends it as `x-api-key` | yes |
| Partner ID | Dashboard UUID | yes |
| Issuer backend URLs | `POST /available-vc` and `POST /issue-vc` on the public HTTPS origin | yes |

Do **not** send `SEED`, `ADMIN_API_KEY`, or partner private keys.

Until AIR completes this, `/available-vc` and `/issue-vc` return **403** before any controller runs, or AIR never routes to you.

Issuer/Verifier menus stay hidden until the DID is registered.

## After the user confirms

```bash
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids --activated yes --jwks-registered yes
```

Then offer `/air issue` or `/air audit`.
