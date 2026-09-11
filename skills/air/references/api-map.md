# API map

Which host, which header.

| Call | Base (sandbox) | Header |
|---|---|---|
| Partner JWT validation (AIR fetches JWKS) | your public HTTPS origin | none |
| `AirService` (SDK) | AIR Kit iframe / hosted widget | Partner JWT as `authToken` |
| `POST /v2/auth/initialize-user` | `https://air.api.sandbox.air3.com` | `x-partner-id` |
| `POST /v1/dstorage/vcs` | `https://api.sandbox.mocachain.org` | `x-partner-auth` |
| `POST /credentials/verify-by-agent` | Moca chain API (see wallet skill) | AIR agent session, not issuer `x-api-key` |
| `POST /v2/wallet/agent-sign` | URL from the handoff bundle | agent `signedMessage` + `agentSignature` |
| `POST /available-vc`, `POST /issue-vc` | your `ISSUER_ORIGIN` | `x-api-key` |
| `GET /credential-status/:nonce` | your `ISSUER_ORIGIN` | none |
| `GET /.well-known/jwks` | your `ISSUER_ORIGIN` | none |
| Admin issuance / revoke | your `ISSUER_ORIGIN` | `x-admin-api-key` |

Issuer DID is not an HTTP route. Read it from `PARTNER.md` or `issuer-did.mjs` (nest repl).

Production hosts differ; load [environments.md](environments.md) and do not reuse sandbox IDs.

When docs and `air-issuer-service` disagree on a path or header name, the running backend wins for its own routes; docs win for what AIR expects.
