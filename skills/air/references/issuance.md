# Issuance (issuer service)

Fork https://github.com/MocaNetwork/air-issuer-service. The holder claims through `AirService.issueCredential`; AIR then calls your backend.

```
Holder (browser + AirService.issueCredential)
  → AIR Credential API
    → POST /available-vc   x-api-key
    → POST /issue-vc       x-api-key
```

`holderDID`, `pubKey`, `userId` always come from AIR. Look up claims by `userId`.

## Backend env

Match [air-issuer-service `.env.example`](https://github.com/MocaNetwork/air-issuer-service/blob/main/.env.example). Only these names:

```
NODE_ENV=sandbox
DATABASE_URL=postgres://postgres:postgres@127.0.0.1/issuer-backend
ISSUER_ORIGIN=http://localhost:3000
SEED=0x...
PARTNER_ID=...
PARTNER_PRIVATE_KEY_KID=...
PARTNER_PRIVATE_KEY_DER=...
SD_JWT_JWKS='{"keys":[...]}'
#SD_JWT_TSL_PARTITION_SIZE=80000
API_KEY=...
ADMIN_API_KEY=...
```

`NODE_ENV=sandbox` selects the sandbox AIR / Moca origins inside the service. `NODE_ENV=production` for mainnet. Do not set `AIR_API_ORIGIN`, `MOCA_CHAIN_API_ORIGIN`, or `IDEN3_*` — the service owns those.

`SEED` determines the issuer DID. Generate once, back it up, never rotate a registered issuer. The seed is never shared with AIR.

Read the DID with the nest repl (needs the cloned backend and a written `.env`):

```bash
echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -
```

or `node scripts/issuer-did.mjs --backend apps/backend`. Repl boots without Postgres when `DATABASE_URL` is empty (dev only).

Local Postgres and migrations are opt-in. See the [init.md](init.md) runbook (`Database` field). Do not start Docker or run `migration:up` unless the user chose a database.

## Schema class

```ts
export default class Schema extends BaseSchema {
  public readonly schemaId = '<SCHEMA_ID>';
  public readonly schemaType = '<TYPE>';
  public readonly schemaUrl = 'https://...';
  public readonly schemaContextUrl = 'https://...';

  async generateCredentialData(userId: string) {
    return {
      credentialSubject: {
        // no `id`
        is_member: true,
      },
      expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };
  }
}
```

Register in `src/issuer/schemas/index.ts`. Never set `credentialSubject.id`.

## Routes

AIR → `POST /available-vc`, `POST /issue-vc` (`x-api-key`). Public: `/credential-status/:nonce`, `/revocation-status/:nonce`, `/.well-known/jwks`. Admin: `x-admin-api-key`.

`POST /issue-vc` returns an empty body after DStorage upload.

## Wire contract (do not drift)

Holder encryption: X25519 ephemeral, ECDH, HKDF sha256, info `data-enc-aes-256-gcm`, aes-256-gcm. Issuer DID: BJJ, SMT revocation, depth 40. `credentialStatus.id` = `${ISSUER_ORIGIN}/credential-status`.

Outbound hosts are selected from `NODE_ENV` inside `air-issuer-service`. When docs and the running backend disagree, the backend is authoritative for its own behavior; docs are authoritative for what AIR expects. Flag the discrepancy.

## Docs to read when MCP is connected

`/airkit/usage/credential/credentials-flow`, `issuing-credentials`, `jwks-setup`, `partner-authentication`, `/airkit/quickstart/issue-credentials`, `issuance-api`.
