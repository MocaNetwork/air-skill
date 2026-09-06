# Verification

Verifier apps do not host `air-issuer-service` unless the same partner is also an issuer.

## SDK

`airService.verifyCredential` with a Partner JWT and a verification program ID. Same JWKS rules as issue. Same network as the credential.

If issuance succeeded and verify fails, check schema key/types (merklization) and `credentialStatus` — a bad `ISSUER_ORIGIN` at issue time embeds a dead status URL. Re-issue after fixing the origin.

## Agent

`/credentials/verify-by-agent` in `query_match` mode. Use `MocaNetwork/air-agentic-wallet-skill` (`moca-credential-verifier` scripts). Never call Privy.

## Selective disclosure

Early-access. Load `/airkit/early-access/selective-disclosure` only when the user needs a subset of fields.

## Dashboard

Verifier menus appear only after AIR registers an issuer DID on that partner — even if this app only verifies. If menus are missing, the partner still needs the [register.md](register.md) pack (often from the issuer side).
