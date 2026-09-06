# /air issue

Scaffold or repair issuance. Read `PARTNER.md` + `AIR.md` first. The path is **self-hosted `air-issuer-service`** plus `airService.issueCredential`.

**Backend only** clone: https://github.com/MocaNetwork/air-issuer-service

**Frontend:** do not clone a sample app. Use a default Next scaffold (`create-next-app`) or routes in the existing app. Copy JWKS and Partner JWT stubs from this skill (`scripts/jwks.mjs emit`). Implement `AirService` + `issueCredential` from [account.md](account.md) and the snippet below.

Custom-auth is opt-in only (`PARTNER.md`). Follow `/recipes/custom-auth-integration` on docs.moca.network — do not switch the frontend to a sample repo.

## Existing codebase

Audit against [issuance.md](issuance.md) and [auth.md](auth.md). Announce what already exists. Fill gaps. Do not clone on top of a working tree.

## Greenfield backend

Ask once, then:

```bash
node <skill-base-dir>/scripts/issue.mjs --clone-backend --yes --dir apps/backend
```

Wire env already written by `keys.mjs`. `DATABASE_URL` must be `postgres://…` (not JDBC). Apply migrations. `GET /ready` must report `ready`.

Do **not** change `/available-vc`, `/issue-vc`, or `/credential-status/:nonce`. If CORS is enabled, allow `*.air3.com`.

## Frontend

Greenfield: `create-next-app` (App Router). Existing app: add the two API routes and a client page. Copy stubs:

```bash
node <skill-base-dir>/scripts/jwks.mjs emit --target <web-root>
```

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

## Public HTTPS

AIR cannot reach localhost.

```bash
cloudflared tunnel --url http://localhost:3000   # issuer
cloudflared tunnel --url http://localhost:3001   # web / JWKS
```

Set `ISSUER_ORIGIN` to the backend tunnel (no trailing slash) and restart. The origin is baked into every credential's status URL.

## 401 on issueCredential

Load [auth.md](auth.md). Usual causes: JWKS not registered, not HTTPS, `kid` mismatch, expired token, missing `scope: "issue"`.
