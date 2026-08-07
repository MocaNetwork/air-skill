# Frontend and frontend-to-backend issuance

The web app does three things: publish a JWKS document, sign short-lived Partner
JWTs on the server, and call `airService.issueCredential`. It never calls the
issuer backend's claim routes.

```
Browser
  → airService.issueCredential({ authToken, issuerDid, credentialId, credentialSubject })
    → AIR Credential API        validates the JWT against your JWKS,
                                resolves holderDID / pubKey / userId
      → your issuer backend     POST /available-vc, POST /issue-vc  (x-api-key)
```

Reference implementation:
`https://raw.githubusercontent.com/MocaNetwork/air-issuer-service-simulator/main/apps/web/<path>`
— see `app/api/.well-known/jwks/route.ts`, `app/api/partner-jwt/route.ts`,
`lib/air.ts`, and `app/claim-simulator.tsx`.

## Install

```bash
pnpm add @mocanetwork/airkit jose
```

`jose` signs the Partner JWT and derives the JWK. Use it server-side only.

## Environment

```
# Public (browser)
NEXT_PUBLIC_PARTNER_ID=
NEXT_PUBLIC_ISSUER_DID=
NEXT_PUBLIC_ISSUE_PROGRAM_ID=
NEXT_PUBLIC_BUILD_ENV=sandbox

# Server-only. Key bodies without PEM headers.
PARTNER_PUBLIC_KEY=
PARTNER_PRIVATE_KEY=
SIGNING_ALGORITHM=RS256
```

`NEXT_PUBLIC_ISSUER_DID` must equal what the backend reports at
`/.well-known/issuer-did`. `NEXT_PUBLIC_ISSUE_PROGRAM_ID` is the issuance
program ID from the Dashboard, passed to the SDK as `credentialId`.

The private key must never reach the browser — no `NEXT_PUBLIC_` prefix, and
never imported into a client component.

## JWKS route

`app/api/.well-known/jwks/route.ts`. AIR fetches this over HTTPS to validate
every Partner JWT you sign.

```ts
import { NextResponse } from "next/server";
import * as jose from "jose";

export async function GET() {
  const publicKeyBody = process.env.PARTNER_PUBLIC_KEY;
  const algorithm = process.env.SIGNING_ALGORITHM;
  const partnerId = process.env.NEXT_PUBLIC_PARTNER_ID;

  if (!publicKeyBody || !algorithm || !partnerId) {
    return NextResponse.json({ error: "Missing partner key configuration" }, { status: 500 });
  }

  const publicKey = await jose.importSPKI(
    `-----BEGIN PUBLIC KEY-----\n${publicKeyBody}\n-----END PUBLIC KEY-----`,
    algorithm,
  );
  const jwk = await jose.exportJWK(publicKey);

  return NextResponse.json(
    { keys: [{ ...jwk, kid: partnerId, use: "sig", alg: algorithm }] },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
```

Using the Partner ID as the `kid` keeps the JWKS and the JWT header trivially in
sync. Any stable identifier works as long as both sides use the same one.

Non-Next stacks: serve the same JSON at any public HTTPS path and register that
exact URL. The route path is a convention, not a requirement.

## Partner JWT route

`app/api/partner-jwt/route.ts`. Signs a short-lived token with `scope: "issue"`.

```ts
import { NextResponse } from "next/server";
import * as jose from "jose";

function wrapPrivateKeyPem(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

export async function POST() {
  const privateKeyBody = process.env.PARTNER_PRIVATE_KEY;
  const algorithm = process.env.SIGNING_ALGORITHM;
  const partnerId = process.env.NEXT_PUBLIC_PARTNER_ID;

  if (!privateKeyBody || !algorithm || !partnerId) {
    return NextResponse.json({ error: "Missing partner key configuration" }, { status: 500 });
  }

  const privateKey = await jose.importPKCS8(wrapPrivateKeyPem(privateKeyBody), algorithm);
  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({ partnerId, scope: "issue" })
    .setProtectedHeader({ alg: algorithm, kid: partnerId, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(privateKey);

  return NextResponse.json({ token });
}
```

JWT requirements, all enforced by AIR:

| Part | Value |
| --- | --- |
| Claims | `partnerId`, `scope: "issue"` |
| Header | `kid` matching a key in your JWKS, `typ: "JWT"` |
| Algorithm | `RS256` or `ES256`, matching the JWKS key type |
| Expiry | Short; five minutes is the recommendation |

In production, put your own session check in front of this route. As written,
anyone who can reach it gets an issuance-scoped token.

## Initialize AirService

```ts
import { AirService, BUILD_ENV } from "@mocanetwork/airkit";

let service: AirService | null = null;

export async function getInitializedAirService() {
  if (service) return service;

  service = new AirService({ partnerId: process.env.NEXT_PUBLIC_PARTNER_ID! });
  await service.init({
    buildEnv: BUILD_ENV.SANDBOX,
    enableLogging: true,
    preloadCredential: true,
  });
  return service;
}

export async function fetchPartnerJwt(): Promise<string> {
  const res = await fetch("/api/partner-jwt", { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch Partner JWT");
  return (await res.json()).token;
}
```

`preloadCredential: true` warms the credential module and noticeably shortens
the first issuance. The SDK renders in an iframe, so this must run in the
browser — in Next.js App Router that means a `"use client"` component or a
`useEffect`.

## Trigger issuance

```ts
export async function issueCredential() {
  const air = await getInitializedAirService();

  if (!air.isLoggedIn) {
    await air.login();
  }

  const authToken = await fetchPartnerJwt();

  return air.issueCredential({
    authToken,
    issuerDid: process.env.NEXT_PUBLIC_ISSUER_DID!,
    credentialId: process.env.NEXT_PUBLIC_ISSUE_PROGRAM_ID!,
    credentialSubject: {
      historical_amount: "1000",
    },
  });
}
```

Signature: `{ authToken, issuerDid, credentialId, credentialSubject, curve? }`,
resolving to `{ cakPublicKey? }`.

The `credentialSubject` you pass here is **not** the signed source of truth. In
the hosted flow AIR calls your backend, and what your schema class returns from
`generateCredentialData` is what gets signed. Treat this argument as a hint to
the program, and keep the authoritative claims server-side.

Fetch a fresh token for every call. Tokens expire in five minutes and reuse
across a long-lived session produces intermittent 401s that look like flakiness.

## Sandbox versus production

Sandbox runs on Moca Chain Testnet and uses
`https://developers.sandbox.air3.com/dashboard`. Production is a private mainnet
requiring approval, with its own dashboard at
`https://developers.air3.com/dashboard` and `BUILD_ENV.PRODUCTION`.

Credentials, schemas, and programs are network-specific. Nothing issued on
testnet is visible on mainnet, and issuer DIDs may differ per network. Plan on
re-issuing when you migrate.

## Custom auth — only when asked

The default flow uses AIR Kit's own login (`airService.login()` with Google,
passwordless email, or wallet). If the user explicitly wants to reuse their
existing auth, the `custom-auth` branch of the simulator repository is the
worked example, and `/recipes/custom-auth-integration` is the doc. In that
variant the backend signs the JWT with `email` and `partnerUserId` claims and
the frontend calls `airService.login({ authToken })`. Do not build this by
default — it adds a partner-orchestrated issuance path and a second backend
route that the standard flow does not need.
