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

`DATABASE_URL` (postgres://, required), `ISSUER_ORIGIN` (public HTTPS, no trailing slash), `AIR_API_ORIGIN`, `MOCA_CHAIN_API_ORIGIN`, `SEED` (32-byte hex, `0x`-prefixed), `IDEN3_METHOD=air`, `IDEN3_BLOCKCHAIN=id`, `IDEN3_NETWORK_ID=testnet`, `PARTNER_ID`, `PARTNER_PRIVATE_KEY_KID`, `PARTNER_PRIVATE_KEY_ALG=ES256`, `PARTNER_PRIVATE_KEY_DER`, `API_KEY`, `ADMIN_API_KEY`.

`SEED` determines the issuer DID together with the three `IDEN3_*` values. Generate once, back it up, never rotate a registered issuer. The seed is never shared with AIR.

Read the DID: `GET /.well-known/issuer-did` or the boot log. Repl needs a reachable `DATABASE_URL`.

Local Postgres:

```bash
docker run --name air-issuer-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=issuer-backend -p 5432:5432 -d postgres:16
npx mikro-orm migration:up
curl -s http://localhost:3000/ready
```

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

AIR → `POST /available-vc`, `POST /issue-vc` (`x-api-key`). Public: `/ready`, `/credential-status/:nonce`, `/revocation-status/:nonce`, `/.well-known/issuer-did`. Admin: `x-admin-api-key`.

`POST /issue-vc` returns an empty body after DStorage upload.

## Wire contract (do not drift)

Holder encryption: X25519 ephemeral, ECDH, HKDF sha256, info `data-enc-aes-256-gcm`, aes-256-gcm. Issuer DID: BJJ, SMT revocation, depth 40. `credentialStatus.id` = `${ISSUER_ORIGIN}/credential-status`.

Outbound: `POST {AIR_API_ORIGIN}/v2/auth/initialize-user` header `x-partner-id`; `POST {MOCA_CHAIN_API_ORIGIN}/v1/dstorage/vcs` header `x-partner-auth`.

Current constants: `apps/backend/WIRE-CONTRACT.md` on the simulator repo. When docs and the running backend disagree, the backend is authoritative for its own behavior; docs are authoritative for what AIR expects. Flag the discrepancy.

## Docs to read when MCP is connected

`/airkit/usage/credential/credentials-flow`, `issuing-credentials`, `jwks-setup`, `partner-authentication`, `/airkit/quickstart/issue-credentials`, `issuance-api`.
