# /air issue

Scaffold or repair issuance. Read `PARTNER.md` + `AIR.md` first. The path is **self-hosted `air-issuer-service`** plus `airService.issueCredential`.

Init (A–C: clone, keys, DID) must already have run for a greenfield issuer. This file is J, D, K. Then hand off to [register.md](register.md).

**Backend only** clone: https://github.com/MocaNetwork/air-issuer-service

**Frontend:** do not clone a sample app. Use a default Next scaffold (`create-next-app`) or routes in the existing app. Copy JWKS and Partner JWT stubs from this skill (`scripts/jwks.mjs emit`). Implement `AirService` + `issueCredential` from [account.md](account.md) and the snippet below.

Custom-auth is opt-in only (`PARTNER.md`). Follow `/recipes/custom-auth-integration` on docs.moca.network — do not switch the frontend to a sample repo.

Never ask the user for `ISSUER_ORIGIN`, `/available-vc`, `/issue-vc`, or the JWKS URL.

## Existing codebase

Audit against [issuance.md](issuance.md) and [auth.md](auth.md). Announce what already exists. Fill gaps. Do not clone on top of a working tree.

## Greenfield backend

Already covered by [init.md](init.md) steps E–G. Ask once, then:

```bash
node <skill-base-dir>/scripts/issue.mjs --clone-backend --yes --install --dir apps/backend
```

Do **not** change `/available-vc`, `/issue-vc`, or `/credential-status/:nonce`. If CORS is enabled, allow `*.air3.com`.

Database and `migration:up` belong to the init runbook (`Database` field). Do not start Postgres here unless that field is `docker` or `external`.

## J — Frontend (only if `Frontend` is `next`)

`Frontend: none` — skip this step and JWKS emit.

`Frontend: next`:

```bash
npx create-next-app@latest
```

Wait for the user to confirm the app directory before emitting routes.

`Frontend: existing` — add the two API routes and a client page to the existing app.

## D — JWKS / Partner JWT stubs (only if `Frontend` is not `none`)

```bash
node <skill-base-dir>/scripts/jwks.mjs emit --target <web-root>
```

The JWKS route serves `SD_JWT_JWKS`. The Partner JWT route signs with `PARTNER_PRIVATE_KEY_DER` and `PARTNER_PRIVATE_KEY_KID`.

Browser flow:

```
airService.issueCredential({ authToken, issuerDid, credentialId, credentialSubject })
  → AIR validates JWT against JWKS, resolves holder
  → POST /available-vc, POST /issue-vc with x-api-key
```

The browser **never** calls Nest claim routes.

```ts
await air.issueCredential({
  authToken, // from POST /api/partner-jwt, fresh each call
  issuerDid: process.env.NEXT_PUBLIC_ISSUER_DID!,
  credentialId: process.env.NEXT_PUBLIC_ISSUE_PROGRAM_ID!,
  credentialSubject: { /* hint only; schema class is source of truth */ },
});
```

`credentialSubject` here is not the signed source of truth. `generateCredentialData` is.

Install: `pnpm add @mocanetwork/airkit jose`. `jose` is server-only.

## K — Public HTTPS

AIR cannot reach localhost. The skill sets `ISSUER_ORIGIN=http://localhost:3000` for local boot. Before a real claim, replace it with the tunnel origin (no trailing slash) and restart. Do not ask the user to invent the origin — run the tunnel and write the URL the tunnel prints.

```bash
cloudflared tunnel --url http://localhost:3000   # issuer
cloudflared tunnel --url http://localhost:3001   # web / JWKS
```

Claim URLs the skill fills into the register pack:

- `${ISSUER_ORIGIN}/available-vc`
- `${ISSUER_ORIGIN}/issue-vc`

Then [register.md](register.md). After the tunnel exists, guide the user to paste JWKS URL, Available VC API, and Issue VC API (optional) on the Dashboard. The skill supplies the strings; the user only pastes.

## 401 on issueCredential

Load [auth.md](auth.md). Usual causes: JWKS not registered, not HTTPS, `kid` mismatch, expired token, missing `scope: "issue"`.
