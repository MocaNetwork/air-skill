# /air schema

Design the credential subject before writing issuer code. Dashboard: Issuer → Schemas (menus appear only after DID registration).

## Rules

- Keys and types must match the Dashboard schema exactly. A string where the schema says number breaks merklization; the failure shows up at verify, not issue.
- **Never set `credentialSubject.id`.** The framework sets it to the holder DID. An email there fails with `must match format "uri"`.
- Prefer booleans, enums, and brackets over raw PII. Do not store `dob`, `ssn`, `fullName`, or `email` when `is_over_18`, `kyc_tier`, or `is_member` works.
- `expiration` is unix **seconds**.
- Eligibility lives in `claimableVCs` / your lookup by `userId`. AIR supplies `holderDID`, `pubKey`, and `userId` — never trust client-supplied holder fields.

## Schema class shape

See [issuance.md](issuance.md). File: `src/issuer/schemas/schema-<SCHEMA_ID>.ts`, register in `index.ts`.

Record schema IDs and program IDs in `PARTNER.md` via `provision.mjs write-ids`.
