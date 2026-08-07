---
name: air-credential-issuance
description: End-to-end guide for integrating AIR credential issuance on Moca Network — which docs.moca.network pages to read, how to stand up the self-hosted NestJS issuer backend (seed, issuer DID, Postgres, schema classes, available-vc/issue-vc), how to wire the Next.js frontend (JWKS route, Partner JWT, airService.issueCredential), and how to connect them. Use when the user mentions AIR Kit, AIR credentials, Moca Network issuance, issuer DID, available-vc, issue-vc, air-issuer-service, or asks to build/debug a verifiable credential issuer.
---

# AIR Credential Issuance

Build or repair a working AIR credential issuance stack: a self-hosted issuer
backend that AIR calls, plus a frontend that starts the holder claim flow.

This skill is self-contained. Every artifact it needs is fetched from public
remotes — never from files that happen to exist in the current workspace.

## Canonical remotes

| Remote | Use it for |
| --- | --- |
| `https://github.com/MocaNetwork/air-issuer-service` | Reference issuer backend. Authoritative for seed generation, partner keys, issuer DID derivation, and the backend HTTP contract |
| `https://github.com/MocaNetwork/air-issuer-service-simulator` (`main`) | Full pnpm monorepo: same backend plus a Next.js claim simulator. Default starting point for new work |
| `https://github.com/MocaNetwork/air-issuer-service-simulator` (`custom-auth`) | Bring-your-own-auth variant. **Opt-in only** — do not implement it unless the user explicitly asks |
| `https://docs.moca.network` | Product docs, dashboard steps, API reference |

Read files from a remote without cloning:

```bash
curl -s https://raw.githubusercontent.com/MocaNetwork/air-issuer-service-simulator/main/<path>
```

List every file on a branch:

```bash
curl -s "https://api.github.com/repos/MocaNetwork/air-issuer-service-simulator/git/trees/main?recursive=1" \
  | jq -r '.tree[] | select(.type=="blob") | .path'
```

## Progress checklist

Copy this into your working notes and keep it updated:

```
- [ ] Step 0: Read the required docs pages
- [ ] Step 1: Pick the mode (greenfield / existing codebase / debugging)
- [ ] Step 2: Audit existing credentials; onboard the user for whatever is missing
- [ ] Step 3: Backend — env, seed, issuer DID
- [ ] Step 4: Backend — Postgres and migrations
- [ ] Step 5: Backend — schema class for the credential type
- [ ] Step 6: Frontend — JWKS route and Partner JWT route
- [ ] Step 7: Frontend — AirService init and issueCredential
- [ ] Step 8: Expose both apps over public HTTPS
- [ ] Step 9: Register with the Dashboard and the AIR team
- [ ] Step 10: Preflight and end-to-end smoke test
```

## Step 0 — Read the docs first

Do not start writing code before reading. Open [docs-map.md](docs-map.md) and
read the pages in the **Required core** table. That is roughly six pages and it
is what separates a working integration from a plausible-looking one.

If a Moca Network documentation MCP server is available, prefer it over web
fetches — it exposes the same pages as `.mdx` paths and supports search.
Otherwise fetch `https://docs.moca.network/<path>` directly.

## Step 1 — Pick the mode

**Greenfield ("build me an AIR issuer").** Clone the simulator monorepo and
reshape it. It is a pnpm workspace with `apps/backend` (NestJS) and `apps/web`
(Next.js), already wired end to end:

```bash
git clone --depth 1 --branch main \
  https://github.com/MocaNetwork/air-issuer-service-simulator.git <target-dir>
cd <target-dir>
rm -rf .git && git init
pnpm install
```

Then rename the workspace packages, strip the demo schema, and follow Steps 2
onward. Do not switch to the `custom-auth` branch by default.

**Backend only.** Clone `air-issuer-service` instead — same backend without the
Next.js app — and add your frontend to the user's existing project.

**Existing codebase.** Do not clone. Audit what is already present against the
tables in [backend.md](backend.md) and [frontend.md](frontend.md), then fill the
gaps. Announce which pieces already exist before changing anything.

**Debugging.** Go straight to [troubleshooting.md](troubleshooting.md); it is
organized by observed symptom.

## Step 2 — Audit credentials, then onboard if anything is missing

**Do this before writing code.** Follow [onboarding.md](onboarding.md).

First audit: check the project for the seed, API keys, partner keypair, Partner
ID, schema and program IDs, and API origins. Report which are present, which you
can generate, and which only the user can supply — without printing any secret
value.

Then act on the gaps:

- **You can generate** the seed, `API_KEY`, `ADMIN_API_KEY`, and the partner
  keypair. `bin/generate-secrets` in `air-issuer-service` emits all of them at
  once; see [onboarding.md](onboarding.md#step-c--generate-the-secrets).
- **Only the user can supply** the Partner ID, schema IDs, issuance program ID,
  and the AIR API origins — and only the user can create the sandbox account,
  deploy a public backend, register JWKS, whitelist the domain, and send the
  activation details to the AIR team.

If anything in the second group is missing, relay the full onboarding sequence
in [onboarding.md](onboarding.md#step-b--if-details-are-missing-give-the-user-these-steps)
verbatim, then ask for what you need in a single message rather than one
question at a time.

Credential menus in the Dashboard stay hidden until AIR registers an issuer DID
against the partner account. If the user cannot see Issuer → Schemas, they are
blocked on Step 9 — generate the seed and read the DID first so they have
something to send.

Never invent any of these values. A placeholder that fails loudly beats a
plausible-looking guess that fails three steps later.

## Steps 3–5 — Backend

Follow [backend.md](backend.md). It covers, in order: environment variables and
what each one does, generating `SEED` and reading the derived issuer DID,
Postgres and MikroORM migrations, the `BaseSchema` subclass that decides what to
issue, and the exact request and response shapes of `/available-vc` and
`/issue-vc`.

Two rules that break issuance if violated:

- `SEED` determines the issuer DID. Generate it once, back it up, never rotate
  it for a live issuer.
- Never set `credentialSubject.id` in your schema class. The framework sets it
  to the holder DID. An email there fails validation with
  `must match format "uri"`.

## Steps 6–7 — Frontend

Follow [frontend.md](frontend.md). It covers the JWKS route, the Partner JWT
route, `AirService` initialization, and the `issueCredential` call.

The browser never calls your issuer backend directly. The frontend calls
`airService.issueCredential(...)`; AIR resolves the holder and calls your
backend server-to-server with `x-api-key`.

## Step 8 — Public HTTPS

AIR servers cannot reach `localhost`. Both apps need public HTTPS origins before
anything works end to end. For local development, tunnel them:

```bash
cloudflared tunnel --url http://localhost:3000   # issuer backend
cloudflared tunnel --url http://localhost:3001   # web app (JWKS lives here)
```

Set `ISSUER_ORIGIN` to the backend tunnel URL and restart the backend — the
origin is baked into every issued credential's status URL, so a stale value
produces credentials whose revocation status can never be checked.

## Step 9 — Register

Two separate registrations, frequently confused:

**Self-serve, in the Dashboard.** Account → General → JWKS URL. Paste the full
HTTPS URL your app actually serves, e.g.
`https://<web-tunnel>/api/.well-known/jwks`. Also whitelist your web origin
under Domains.

**Manual, by email to the Moca Network / AIR team.** There is no self-serve
field for the issuer backend API key. Send all four:

| Item | Source |
| --- | --- |
| Issuer DID | `GET ${ISSUER_ORIGIN}/.well-known/issuer-did` |
| API key | The backend's `API_KEY` value; AIR will send it as `x-api-key` |
| Partner ID | Dashboard UUID |
| Issuer backend URLs | Full HTTPS URLs for `POST /available-vc` and `POST /issue-vc` |

Until the AIR team completes this, AIR either will not call your backend at all
or will call without a matching key and the backend returns 403 before any
controller runs.

Only the user can perform both registrations. Give them the exact four values
and confirm they were sent; see
[onboarding.md](onboarding.md#step-e--hand-off-and-record).

## Step 10 — Verify

Run `scripts/preflight.sh` from this skill's own directory (the folder holding
this `SKILL.md`), not from the project root:

```bash
sh <skill-dir>/scripts/preflight.sh https://<backend-origin> https://<web-origin>
```

It checks backend readiness (database, pending migrations, issuer DID), that the
issuer DID endpoint responds, that JWKS is reachable over HTTPS and exposes a
`kid`, and that the Partner JWT route signs a token whose `kid` matches. Fix
everything it reports before attempting a claim.

Then run the real flow: open the web app, log in, trigger issuance, and confirm
the credential appears under Dashboard → Issuer → Usage Records.

## Guardrails

- **Never invent** a Partner ID, schema ID, program ID, issuer DID, or API
  origin. Ask, or leave a clearly marked placeholder that fails loudly.
- **Never commit or print** `SEED`, `PARTNER_PRIVATE_KEY*`, `API_KEY`, or
  `ADMIN_API_KEY`. They belong in gitignored `.env` files, and they must not
  appear in chat output, commit messages, or summaries. Redirect generator
  output to a file rather than echoing it.
- **The issuer seed is never shared with AIR.** Only the issuer DID, API key,
  Partner ID, and backend URL leave your side.
- **Never change** the request/response shapes of `/available-vc` and
  `/issue-vc`, the holder encryption parameters, or the
  `GET /credential-status/:nonce` route. External systems depend on all three;
  see the encryption and DID-derivation constants in
  [backend.md](backend.md#wire-contract).
- **Never trust client-supplied holder fields.** AIR resolves `holderDID`,
  `pubKey`, and `userId`; look up eligibility by `userId`.
- **Do not add custom auth** unless asked. The default flow uses AIR Kit's own
  login.
- If you enable CORS anywhere in front of the backend, allow `*.air3.com`.

## Reference files

- [docs-map.md](docs-map.md) — which docs.moca.network pages to read, and when
- [onboarding.md](onboarding.md) — audit existing credentials; what to ask the user for
- [backend.md](backend.md) — issuer backend: env, seed, DID, database, schemas, API
- [frontend.md](frontend.md) — JWKS, Partner JWT, AirService, issueCredential
- [troubleshooting.md](troubleshooting.md) — failures indexed by symptom
- `scripts/preflight.sh` — run it; verifies a deployment before a claim attempt
