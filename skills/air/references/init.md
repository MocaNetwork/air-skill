# /air init · keys · provision

Init interviews once and writes traveling context. Keys change secrets on disk after the backend exists. Provision updates IDs only.

## Interview

STOP and ask. Do not invent a Partner ID. Do not ask for `ISSUER_ORIGIN`, `/available-vc`, `/issue-vc`, or a JWKS URL — the skill produces those later.

Keep to these focused rounds (issuer / both). Skip database and frontend for verifier / account-only / agentic.

1. **Role:** issuer / verifier / both / account-only / agentic
2. **Existing partner?** new credentials vs they already have Partner ID, SEED, keys, and maybe an issuer DID
3. **Partner ID** (new partners, or existing if they have it handy): send them to the Dashboard, wait for paste. Existing partners may skip this if the ID lives in the `.env` they will import.
4. **Auth** (issuer/both only): AIR Kit login (default) vs BYO / custom-auth
5. **Database** (issuer/both only): docker / I have Postgres (`--db external --database-url`) / none
6. **Frontend** (issuer/both only): none (backend only) / scaffold Next / existing app

Sandbox Dashboard: https://developers.sandbox.air3.com/ → Account → General → Partner ID (UUID).

Production is a separate partner / DID / program set. Init always writes **sandbox** defaults. Load [environments.md](environments.md) only if they insist on mainnet.

Optional: vertical (loyalty, gaming, fintech, events, ads, agents).

Show each scaffold command separately when asking what to run next. Do not batch them into one silent script.

## Write files

```bash
node <skill-base-dir>/scripts/init.mjs --role <role> --partner-id <uuid> [--existing] [--auth air-login|byo] [--db docker|external|none] [--database-url <url>] [--frontend none|next|existing] [--vertical loyalty]
```

`--partner-id` is required unless `--existing`. Refuse overwrite unless the user asked to redo init (`--force`).

Then tell them what was written: `PARTNER.md`, `AIR.md`, `.env.example`.

## Issuer or both — ordered runbook

Gates come from `PARTNER.md`: `Existing partner`, `Database`, `Frontend`.

### A — init

```bash
node <skill-base-dir>/scripts/init.mjs --role issuer --partner-id <uuid> --db <docker|external|none> --frontend <none|next|existing>
```

Existing partner: add `--existing` and omit `--partner-id` if it will come from the imported env.

### F — database (only if `Database` is not `none`)

`Database: docker`:

```bash
docker run --name air-issuer-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=issuer-backend -p 5432:5432 -d postgres:16
```

`Database: external`: keep the user's `DATABASE_URL` and pass `--database-url` to `keys.mjs`. Do not invent a host.

`Database: none`: skip docker and skip migrations. Upstream stubs the EntityManager when `DATABASE_URL` is unset, so the backend and repl still boot (dev only; no issuance history).

### E + G — clone backend, then install

```bash
node <skill-base-dir>/scripts/issue.mjs --clone-backend --yes --install --dir apps/backend
```

Do not generate keys before this clone. The DID script needs the Nest app.

### B — keys (generate or import)

New partner:

```bash
node <skill-base-dir>/scripts/keys.mjs --env sandbox [--database-url <url>]
```

Existing partner:

```bash
node <skill-base-dir>/scripts/keys.mjs --env sandbox --import <path-to-existing.env> [--issuer-did did:air:...]
```

Writes `apps/backend/.env` with the upstream names only. Never prints `SEED` or private keys. If `node_modules` is present, this step runs the repl automatically.

Refuse `--import` skip: if `Existing partner: yes`, do not call `keys.mjs` without `--import`.

### H — migrate (only if `Database` is not `none`)

```bash
cd apps/backend && npx mikro-orm migration:up
```

Tied to the database answer. Never run this when `Database: none`.

### I + C — issuer DID

Automatic from `keys.mjs` when the backend is installed. Otherwise:

```bash
echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -
```

or:

```bash
node <skill-base-dir>/scripts/issuer-did.mjs --backend apps/backend
```

That writes `Issuer DID` on `PARTNER.md` and `NEXT_PUBLIC_ISSUER_DID` when a frontend env file exists. Equivalent ID write:

```bash
node <skill-base-dir>/scripts/provision.mjs --env sandbox write-ids --issuer-did did:air:...
```

Show the DID to the user. Do not ask them to invent it.

Then continue with [issue.md](issue.md) for frontend / tunnel (J, D, K) and [register.md](register.md) (L).

## Verifier

Skip `SEED`, issuer backend, `API_KEY`, and the activation email. Still collect Partner ID. Generate a **server-only** signing key + JWKS if they will call AIR verify APIs. Offer `/air verify`. No Nest fork.

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
