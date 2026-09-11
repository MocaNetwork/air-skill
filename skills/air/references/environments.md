# Environments

Init writes **sandbox**. Treat production as a separate integration.

## Sandbox (default)

- Dashboard: https://developers.sandbox.air3.com/
- SDK: `BUILD_ENV.SANDBOX`
- Chain: Moca Testnet
- Issuer backend `NODE_ENV=sandbox` (the service picks AIR / Moca origins from that value)
- AIR API origin (typical): `https://air.api.sandbox.air3.com`
- Moca chain / DStorage: `https://api.sandbox.mocachain.org` (`/v1/...`)
- `credentialNetwork` must not be `"devnet"` (removed). Do not pair sandbox with `"mainnet"`.

## Production

Requires approval. Separate Partner ID, issuer DID, programs, JWKS, and API keys.

- Dashboard: https://developers.air3.com/dashboard
- SDK: `BUILD_ENV.PRODUCTION` + `credentialNetwork: "mainnet"`
- Provisioning scripts **must** take `--env production` and must not reuse sandbox secrets

## Isolation

Credentials, schemas, and programs do not travel across networks. Re-issue on the target network. A Testnet issuer DID is not a Mainnet issuer.

`NEXT_PUBLIC_BUILD_ENV` on the web app must match the Dashboard the operator is looking at.
