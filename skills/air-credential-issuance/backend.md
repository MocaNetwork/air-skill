# Issuer backend

NestJS service that AIR calls during the holder claim flow. Most of the work —
BJJ signing, holder encryption, DStorage upload, revocation trees, migrations —
is already implemented in the reference repositories. You configure identity,
connect a database, and write one schema class per credential type.

Reference sources (fetch with `curl`, do not assume a local copy):

```
https://raw.githubusercontent.com/MocaNetwork/air-issuer-service-simulator/main/apps/backend/<path>
https://raw.githubusercontent.com/MocaNetwork/air-issuer-service/main/<path>
```

Useful paths on both: `.env.example`, `README.md`, `WIRE-CONTRACT.md`
(simulator only), `src/issuer/schemas/base-schema.ts`,
`src/issuer/schemas/index.ts`, `src/issuer/issuer.service.ts`.

## Architecture

```
Holder (browser + @mocanetwork/airkit)
  → AIR Credential API          resolves holderDID, pubKey, userId
    → your backend: POST /available-vc   preview, subject encrypted to holder
    → your backend: POST /issue-vc       sign, encrypt, upload to DStorage
```

`holderDID`, `pubKey`, and `userId` always come from AIR. Use `userId` — your
own primary identifier for that person — to look up eligibility and claims.
Never authorize on client-supplied fields.

## Environment

Copy `.env.example` to `.env` and fill it in. The service refuses to boot
without `DATABASE_URL`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection URL. Required |
| `ISSUER_ORIGIN` | Public origin of this service, no trailing slash. Embedded in every credential as its status URL |
| `AIR_API_ORIGIN` | AIR API origin. Ask the AIR team; sandbox is typically `https://air.api.sandbox.air3.com` |
| `MOCA_CHAIN_API_ORIGIN` | Moca chain API origin for DStorage; sandbox is typically `https://api.sandbox.mocachain.org` |
| `SEED` | 32-byte hex seed for the issuer BabyJubJub identity. Secret. Determines the issuer DID |
| `IDEN3_METHOD` | DID method. Default `air` |
| `IDEN3_BLOCKCHAIN` | Default `id` |
| `IDEN3_NETWORK_ID` | Default `testnet` |
| `PARTNER_ID` | AIR partner UUID from the Dashboard |
| `PARTNER_PRIVATE_KEY_KID` | JWKS key id |
| `PARTNER_PRIVATE_KEY_ALG` | `RS256` or `ES256` |
| `PARTNER_PRIVATE_KEY_DER` | Private key body, DER / PKCS#8 base64, no PEM headers |
| `SD_JWT_HASH_ALG` | SD-JWT hash algorithm, e.g. `sha-256` |
| `API_KEY` | Expected in `x-api-key` on holder-facing routes |
| `ADMIN_API_KEY` | Expected in `x-admin-api-key` on admin routes |
| `MIKRO_ORM_DEBUG` | Optional. `true` logs every SQL statement |
| `PORT` | Optional. Defaults to 3000 |

`PARTNER_PRIVATE_KEY_DER` must be valid PKCS#8 even if you never issue SD-JWT
credentials — it is imported at startup and a bad value stops the boot.

## Seed, keys, and issuer DID

Preferred path: `bin/generate-secrets` in `air-issuer-service` emits `SEED`,
`PARTNER_PRIVATE_KEY_KID`, `PARTNER_PRIVATE_KEY_DER`, `SD_JWT_JWKS`, `API_KEY`,
and `ADMIN_API_KEY` in one shot, already formatted as `.env` lines.

```bash
node bin/generate-secrets >> .env
```

It generates an **EC P-256** key, so set `PARTNER_PRIVATE_KEY_ALG=ES256`. Full
walkthrough, including deriving the web app's public key and keeping the `kid`
consistent across both apps, is in
[onboarding.md](onboarding.md#step-c--generate-the-secrets).

Manual equivalents, if you need one value in isolation:

```bash
echo 0x$(openssl rand -hex 32)                                   # SEED
openssl rand -hex 32                                             # API_KEY / ADMIN_API_KEY
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out partner-private.pem                                       # RS256 keypair
openssl rsa -pubout -in partner-private.pem -out partner-public.pem
```

The env vars want the base64 body only, without the `-----BEGIN-----` and
`-----END-----` lines — code adds the PEM headers back:

```bash
sed '1d;$d' partner-private.pem | tr -d '\n'   # PARTNER_PRIVATE_KEY_DER (backend), PARTNER_PRIVATE_KEY (web)
sed '1d;$d' partner-public.pem  | tr -d '\n'   # PARTNER_PUBLIC_KEY (web, for JWKS)
```

Back the seed up somewhere durable. The issuer DID is a deterministic function
of `SEED` plus the three `IDEN3_*` values; losing the seed means you can never
act as that issuer again, and changing it silently creates a different issuer
that AIR has not registered. The seed stays on the backend — never shared with
AIR, never in frontend code, never committed.

Both apps must use the same keypair **and the same `kid`**: the backend signs
partner JWTs for AIR and DStorage using `PARTNER_PRIVATE_KEY_KID`, the web app
signs its own with the `kid` in its JWT route, and AIR validates both against
the single JWKS URL registered in the Dashboard. Any `kid` you sign with that is
absent from that JWKS produces a 401.

Read the issuer DID once the service is running:

```bash
curl -s http://localhost:3000/.well-known/issuer-did
# { "did": "did:air:id:testnet:...", "issuer": "https://..." }
```

Or without deploying, straight from the repl:

```bash
echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -
```

It is also logged at every boot as `[CredentialIssuingService] Issuer DID: ...`.
Send this DID to the AIR team; credential menus in the Dashboard stay hidden
until they register it.

## Database

Postgres, accessed through MikroORM. The service persists issuance history and
revocation state, both of which are required for credential status checks.

`DATABASE_URL` must be a Node Postgres URL, not a JDBC one:

```
postgres://user:password@127.0.0.1:5432/issuer-backend    correct
jdbc:postgresql://127.0.0.1:5432/issuer-backend           wrong, will not parse
```

Local Postgres via Docker:

```bash
docker run --name air-issuer-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=issuer-backend -p 5432:5432 -d postgres:16
```

Apply migrations before the first issuance. From the simulator monorepo root:

```bash
pnpm migration:up        # apply pending
pnpm migration:pending   # list unapplied
pnpm migration:list      # full history
```

In the standalone backend repo: `npx mikro-orm migration:up`.

Migrations are versioned files under `src/migrations/`. When you add your own
entities, generate a migration rather than hand-editing the schema:

```bash
pnpm migration:create
```

Confirm the database, migrations, and issuer identity together:

```bash
curl -s http://localhost:3000/ready | jq .
```

Returns 200 with `"status": "ready"` when the service can issue, 503 otherwise.
A `checks.migrations.status` of `"fail"` lists the pending migration names.

## Schema classes

One class per credential type. This is the main place you write business logic.

1. In the Dashboard create or open the schema and note four values: schema ID,
   type, schema JSON URL, and JSON-LD context URL.
2. Add `src/issuer/schemas/schema-<SCHEMA_ID>.ts`.
3. Register it in `src/issuer/schemas/index.ts`.

```ts
import { BaseSchema } from './base-schema';

const EXPIRY_SEC = 30 * 24 * 60 * 60;

export default class Schema extends BaseSchema {
  public readonly schemaId = '<SCHEMA_ID>';
  public readonly schemaType = '<TYPE>';
  public readonly schemaUrl = 'https://.../dstorage/download/<...>';
  public readonly schemaContextUrl = 'https://.../dstorage/download/<...>';

  async generateCredentialData(userId: string) {
    // Look up the real claims for this user in your own systems.
    return {
      credentialSubject: {
        // Keys and types must match the Dashboard schema exactly.
        // Do NOT include `id` — the framework sets it to the holder DID.
        historical_amount: '1000',
      },
      expiration: Math.floor(Date.now() / 1000) + EXPIRY_SEC, // unix seconds
    };
  }
}
```

```ts
// src/issuer/schemas/index.ts
import { BaseSchema } from './base-schema';
import Schema from './schema-<SCHEMA_ID>';

const schemas: BaseSchema[] = [new Schema()];
export default schemas;
```

Rules that matter:

- **Never set `credentialSubject.id`.** `BaseSchema.issue` spreads your subject
  and then sets `id` to the holder DID. Putting an email or `userId` there
  overwrites the DID and issuance fails JSON Schema validation with
  `must match format "uri"`.
- **Key names and types must match the Dashboard schema.** A string where the
  schema says number breaks merklization, and the failure surfaces later at
  verification rather than at issuance.
- **`expiration` is unix seconds**, not milliseconds.
- **Eligibility** lives in `claimableVCs`. The default implementation just calls
  `generateCredentialData`; override it when preview and issue should differ, or
  to omit users who do not qualify.
- **Idempotency rules** — one credential per user, re-issue only after expiry —
  belong in your schema or service layer, checked before issuing.
- Keep secrets out of `credentialSubject`. It is encrypted to the holder and
  stored in DStorage, so the holder can read all of it.

## HTTP API

### Called by AIR — requires `x-api-key: <API_KEY>`

`POST /available-vc` — preview claimable credentials.

```json
{
  "holderDID": "did:air:...",
  "pubKey": "0x...",
  "userId": "<partner primary id>",
  "schemaId": "<optional filter>",
  "proofType": "BJJ_SIG_2021"
}
```

```json
{
  "data": [
    {
      "holderDID": "did:air:...",
      "schemaId": "...",
      "credentialSubject": {
        "encryptedData": "...",
        "iv": "...",
        "authTag": "...",
        "dataEncPublicKey": "..."
      }
    }
  ]
}
```

`POST /issue-vc` — same body with `schemaId` required. Builds the VC, signs it,
encrypts it to `pubKey`, uploads to DStorage, records issuance history, and
returns an empty body. The DStorage path stays in your records; it is not
returned to AIR.

### Public — no key

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/ready` | Readiness: database, migrations, issuer DID |
| `GET` | `/credential-status/:nonce` | Non-revocation proof, referenced by every issued credential |
| `GET` | `/revocation-status/:nonce` | `{ "isRevoked": boolean }` |
| `GET` | `/.well-known/issuer-did` | `{ "did": "...", "issuer": "..." }` |
| `GET` | `/.well-known/jwt-vc-issuer` | SD-JWT VC issuer metadata |

### Admin — requires `x-admin-api-key: <ADMIN_API_KEY>`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/issuance-history` | Paginated: `page`, `limit`, `order`, `holderDid`, `schemaId`, `revocationNonce` |
| `POST` | `/admin/revoke` | Body `{ "nonce": "<revocationNonce>" }` |

## Wire contract

These values are agreements with systems you do not control — the holder's
wallet, DStorage, and the AIR API. Drift does not fail loudly; it produces
credentials nobody can decrypt or a DID nobody has registered. Change them only
in coordination with the AIR team.

Holder encryption: X25519 ephemeral key, ECDH, HKDF with `sha256`, empty salt,
info `data-enc-aes-256-gcm`, 32-byte derived key, `aes-256-gcm`, 12-byte random
IV, DER/SPKI public key encoding, base64 field encoding for DStorage.

Issuer DID derivation: `SEED` plus `IDEN3_METHOD` / `IDEN3_BLOCKCHAIN` /
`IDEN3_NETWORK_ID`, BJJ key type, `SparseMerkleTreeProof` revocation status,
Merkle tree depth 40.

Credential issuance: `merklizedRootPosition` = value, `subjectPosition` = index,
`credentialStatus.id` = `${ISSUER_ORIGIN}/credential-status`,
`credentialSubject.id` = the holder DID, always set by the issuer.

Outbound calls: `POST {AIR_API_ORIGIN}/v2/auth/initialize-user` with header
`x-partner-id` and body `{ partnerJwt }`;
`POST {MOCA_CHAIN_API_ORIGIN}/v1/dstorage/vcs` with header `x-partner-auth` and
body `{ holderDid, schemaId, expiresAt, data, iv, authTag, encryptedKey, externalId }`.

The current values live at
`https://raw.githubusercontent.com/MocaNetwork/air-issuer-service-simulator/main/apps/backend/WIRE-CONTRACT.md`.
Check it before relying on any constant above.

## Run

```bash
pnpm install
pnpm migration:up
pnpm start:dev          # or, from the monorepo root: pnpm dev:backend
```

Production: `pnpm build && pnpm start:prod`.

If you enable CORS on the backend or on a proxy in front of it, allow
`*.air3.com`. Restricting to your own domain breaks the claim flow.
