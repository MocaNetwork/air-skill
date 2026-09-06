# Anti-patterns

Never do these. `detect.mjs` catches a subset.

- Generate a new `SEED` after the DID is registered
- Put Partner JWT signing in the browser or under `NEXT_PUBLIC_*`
- Reuse one JWT across users or across issue + verify without the right scope
- Assume Testnet credentials exist on mainnet
- Call Privy directly for agentic wallets
- Store raw PII in `credentialSubject` when a boolean / enum works
- Skip JWKS because login already works
- Invent Partner ID, schema ID, program ID, issuer DID, or API origins
- Set `credentialSubject.id` in a schema class
- Use a JDBC `DATABASE_URL`
- Leave `ISSUER_ORIGIN` on localhost after a real claim
- Pair `BUILD_ENV.SANDBOX` with `credentialNetwork: "mainnet"` or `"devnet"`
- Send `x-api-key` to AIR / Moca chain APIs, or `x-partner-auth` to `/available-vc`
- Change `/available-vc`, `/issue-vc`, or holder encryption parameters
- Commit `.env` / `.env.local`
- Print `SEED`, `API_KEY`, `ADMIN_API_KEY`, or private keys after the first write
