# /air init · keys · provision

Init interviews once and writes traveling context. Keys change secrets on disk. Provision updates IDs only.

## Interview

STOP and ask. Do not invent a Partner ID. Keep to three focused rounds.

1. **Role:** issuer / verifier / both / account-only / agentic
2. **Auth** (issuer/both only): AIR Kit login (default) vs BYO / custom-auth
3. **Partner ID:** send the user to the Dashboard, wait for paste

Sandbox Dashboard: https://developers.sandbox.air3.com/ → Account → General → Partner ID (UUID).

Production is a separate partner / DID / program set. Init always writes **sandbox** defaults. Load [environments.md](environments.md) only if they insist on mainnet.

Optional: vertical (loyalty, gaming, fintech, events, ads, agents).

## Write files

```bash
node <skill-base-dir>/scripts/init.mjs --role <role> --partner-id <uuid> [--auth air-login|byo] [--vertical loyalty]
```

Refuse overwrite unless the user asked to redo init (`--force`).

Then tell them what was written: `PARTNER.md`, `AIR.md`, `.env.example`.

## Issuer or both

1. Partner ID must already be in `PARTNER.md`.
2. Custom-auth is opt-in. Default AIR login. The simulator `custom-auth` branch is reference only: https://github.com/MocaNetwork/air-issuer-service-simulator/tree/custom-auth
3. Generate keys:

```bash
node <skill-base-dir>/scripts/keys.mjs --env sandbox
```

This writes `.env.local` (and `apps/backend/.env` when that folder exists), gitignores env files, sets `kid` = Partner ID, and **does not print** `SEED` or private keys. Confirm presence only.

4. Issuer DID: if keys printed `pending`, boot the issuer backend later and run:

```bash
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids --issuer-did did:air:...
```

Show the DID to the user and tell them to update the Credential Dashboard / send the [register.md](register.md) pack.

5. Emit JWKS stubs if the app is Next:

```bash
node <skill-base-dir>/scripts/jwks.mjs emit --target .
```

6. Offer `/air issue`. Do not clone silently.

## Verifier

Skip `SEED`, issuer backend, `API_KEY`, and the activation email. Still collect Partner ID. Generate a **server-only** signing key + JWKS if they will call AIR verify APIs (`keys.mjs` still applies; they can ignore SEED on a verifier-only app, or you generate only the partner keypair — do not print it). Offer `/air verify`. No Nest fork.

## Account-only

Partner ID + [account.md](account.md). Warn: login can succeed while issue/verify is dead (no JWKS).

## Agentic

Do not copy wallet scripts. Load [agent.md](agent.md).

## provision.mjs

```bash
node <skill-base-dir>/scripts/provision.mjs --env sandbox|production write-ids [--issuer-did ...] [--jwks-url ...]
```

`--env` is required. Updates PARTNER.md **IDs only**.

`createPartner`, `registerJwksUrl`, `activateIssuer`, and other remote actions are Phase 2 stubs. Do not invent curl. Point at the Dashboard and `/air register`.
