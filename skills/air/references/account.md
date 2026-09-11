# /air account

Embed AIR Kit login. Required docs when MCP is available: `/airkit/quickstart/index`, `/airkit/usage/initialization`, `/airkit/usage/user-authentication`.

## Install

```bash
pnpm add @mocanetwork/airkit
```

Partner ID from `PARTNER.md` / `NEXT_PUBLIC_PARTNER_ID`. Never invent it.

```ts
import { AirService, BUILD_ENV } from "@mocanetwork/airkit";

const service = new AirService({ partnerId: process.env.NEXT_PUBLIC_PARTNER_ID! });
await service.init({
  buildEnv: BUILD_ENV.SANDBOX,
  enableLogging: true,
  preloadCredential: true,
});
const loggedIn = await service.login();
```

`preloadCredential: true` warms issue/verify. The SDK renders in an iframe — run this in the browser (`"use client"` / `useEffect`).

Sandbox only in v1 init. Production: `BUILD_ENV.PRODUCTION` + `credentialNetwork: "mainnet"` after approval. See [environments.md](environments.md).

## BYO auth

Only if `PARTNER.md` says `Custom auth: yes`. Backend signs a Partner JWT with `email` and `partnerUserId`; frontend calls `airService.login({ authToken })`. Follow `/recipes/custom-auth-integration` on docs.air3.com. Do not clone a sample app.

## Hard stop

Login succeeding does **not** mean issue or verify will work. Those need a public HTTPS JWKS, a matching `kid`, and (for issue) an activated issuer. Say this out loud.

Next: issuer → `/air schema` then `/air issue`. Verifier → `/air verify`. Agentic → `/air agent`.
