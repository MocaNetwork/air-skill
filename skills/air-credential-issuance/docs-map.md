# Which docs.moca.network pages to read

Base URL: `https://docs.moca.network`. Append each path below.

If a Moca Network documentation MCP server is connected, read pages there
instead — the same paths work with an `.mdx` suffix (`/airkit/usage/credential/issuing-credentials.mdx`),
and it supports keyword search across the whole site.

## Required core

Read all six before writing code. Total reading time is short and each one
covers a failure mode the others do not.

| Order | Path | Why you need it |
| --- | --- | --- |
| 1 | `/airkit/usage/credential/credentials-flow` | The issuer/holder/verifier model, why AIR never sees plaintext, and the six-step issuer process. Sets up everything else |
| 2 | `/airkit/usage/credential/issuing-credentials` | The hosted issuer backend path: Dashboard setup, `available-vc` and `issue-vc` contracts, and the full claim sequence diagram |
| 3 | `/airkit/usage/jwks-setup` | Blocking prerequisite. `issueCredential` fails with 401 until JWKS is hosted, registered, and the `kid` matches |
| 4 | `/airkit/usage/partner-authentication` | Partner JWT claims, headers, algorithms, and expiry for each operation |
| 5 | `/airkit/quickstart/issue-credentials` | The end-to-end walkthrough this skill mirrors, with the frontend `issueCredential` call |
| 6 | `/airkit/usage/credential/issuance-api` | Exact request/response bodies, base URLs per environment, and auth headers |

## Read when the task calls for it

| Path | Read it when |
| --- | --- |
| `/airkit/quickstart/index` | The app has no AIR Kit login yet — covers install, Partner ID, `AirService` setup |
| `/airkit/usage/installation` | Choosing the SDK package and version |
| `/airkit/usage/initialization` | Configuring `init()`, especially `preloadCredential: true` |
| `/airkit/usage/user-authentication` | Deciding between AIR Kit login and bring-your-own-auth |
| `/airkit/environments` | Sandbox vs production, chain IDs, and why credentials do not cross networks |
| `/airkit/usage/credential/schema-creation` | Creating the schema in the Dashboard Schema Builder |
| `/airkit/usage/credential/schema-management` | Versioning or editing an existing schema |
| `/airkit/usage/credential/schema-overview` | Understanding field types before designing `credentialSubject` |
| `/airkit/usage/credential/direct-issuance` | Issuance should run from a batch job or backend event with no user present |
| `/airkit/usage/credential/verify` | The same app also needs to verify credentials |
| `/airkit/airkit-dashboard` | Navigating the Developer Dashboard |
| `/airkit/usage/reference` | Looking up an exact SDK method signature |

## Read for specific situations

| Path | Situation |
| --- | --- |
| `/recipes/custom-auth-integration` | The user explicitly asks for bring-your-own-auth (Firebase, Auth0, Supabase, custom) |
| `/airkit/usage/credential/cak-overview`, `/airkit/usage/credential/cak-issuer-guide` | Compliance encryption / regulated disclosure is required |
| `/airkit/early-access/selective-disclosure` | Holders must reveal a subset of fields |
| `/airkit/troubleshooting/credential-issues` | Issuance fails and the symptom is not in `troubleshooting.md` |
| `/airkit/troubleshooting/common-errors` | An SDK error code needs decoding |
| `/airkit/troubleshooting/sdk-issues` | The SDK misbehaves in the browser (iframe, popup, redirect) |
| `/airkit/usage/user-management` | Mapping AIR users to your own user records |
| `/airkit/usage/config-theming`, `/airkit/usage/config-login`, `/airkit/usage/config-language` | Customizing the AIR Kit widget |
| `/airkit/platform-matrix` | Confirming feature support on a given platform |
| `/airkit/release-notes` | An API appears to have changed |
| `/recipes/kyc-credential-on-event`, `/recipes/loyalty-points-issuance` | The use case matches — these are worked examples |
| `/mocachain/technical-details/decentralized-storage` | Understanding what DStorage does with the encrypted envelope |
| `/learn/security/security-checklist` | Hardening before production |

## Skip unless asked

`/mocachain/guides/*` (running nodes and validators), `/solutions/*` and
`/airkit/guides/*` (vertical marketing overviews), `/learn/vision/*`,
`/learn/why-now/*`, `/kyc/*`, `/airkit/flutter/*` unless the client is Flutter,
and `/airkit/usage/account/*` unless the app needs the embedded wallet.

## When docs and repository disagree

The docs describe the AIR platform contract; the repositories are one concrete
implementation of it. When they conflict on a route or payload — for example the
`initialize-user` path version or its header name — the running reference
backend is authoritative for how that backend behaves, and the docs are
authoritative for what AIR expects. Flag the discrepancy to the user rather than
silently picking one.
