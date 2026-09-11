# AIR Dev skill

 AIR Kit integration skill: one entry point (`/air <cmd>`), traveling `PARTNER.md` + `AIR.md`, scripts that change project state, and static detectors.

This is not the docs-routing skill (`npx skills add https://docs.air3.com`) and not the wallet skill (`npx skills add MocaNetwork/air-agentic-wallet-skill`). Those still matter. This skill is the integration operator.

## Install

From the project root:

```bash
npx air-dev-skill install
```

The installer lists detected agents first and pre-checks them. Space toggles. Enter confirms. Then it asks project vs global and shows the dests for the agents you picked. Reload the harness and type `/air`.

CI / no TTY:

```bash
npx air-dev-skill install -y
npx air-dev-skill install --providers=cursor,claude --scope global
```

Also:

```bash
npx skills add MocaNetwork/air-sdk-ai
```

```text
/plugin marketplace add MocaNetwork/air-sdk-ai
```

CLI after install:

```bash
npx air-dev-skill detect --json
npx air-dev-skill keys --env sandbox
npx air-dev-skill jwks --check https://<origin>/api/.well-known/jwks
```

Docs MCP (optional, complementary): `https://docs.air3.com/mcp`.

## First command

Inside the agent:

```text
/air init
```

Sandbox is the default. The agent asks for role, whether credentials already exist, a **Partner ID** from [Credential Dashboard → Account → General](https://developers.sandbox.air3.com/) (new partners), database, and frontend. It never invents that UUID. It never asks you for `ISSUER_ORIGIN` or claim URLs.

Issuer path: clone [`air-issuer-service`](https://github.com/MocaNetwork/air-issuer-service) → generate or import keys into `apps/backend/.env` → extract issuer DID via the nest repl → optional Next app (JWKS + Partner JWT + `issueCredential`) → tunnel → Dashboard paste. Do not clone the issuer-service simulator.

Verifier path: no `SEED`, no Nest backend, no activation email. `/air verify` wires the SDK.

## Secrets

`SEED`, `PARTNER_PRIVATE_KEY_DER`, `API_KEY`, and `ADMIN_API_KEY` are written to gitignored `apps/backend/.env` (and web `.env.local` when a frontend exists). The skill prints the issuer DID only. Never commit those files. Never put them under `NEXT_PUBLIC_*`.

Sandbox and mainnet are separate partners, DIDs, and programs.

## Commands

Setup: `/air`, `init`, `provision`, `keys`, `issuer-did`, `register`  
Build: `account`, `schema`, `issue`, `verify`, `agent`  
Harden: `audit`, `polish`, `document`

## Related

| Piece | Role |
| --- | --- |
| This repo | Integration skill — context files, commands, detectors |
| [docs.air3.com](https://docs.air3.com) / MCP | Live API and dashboard docs |
| [air-agentic-wallet-skill](https://github.com/MocaNetwork/air-agentic-wallet-skill) | Agent-sign and verify-by-agent scripts |
