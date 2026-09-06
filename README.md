# AIR skill

 AIR Kit integration skill: one entry point (`/air <cmd>`), traveling `PARTNER.md` + `AIR.md`, scripts that change project state, and static detectors.

This is not the docs-routing skill (`npx skills add https://docs.moca.network`) and not the wallet skill (`npx skills add MocaNetwork/air-agentic-wallet-skill`). Those still matter. This skill is the integration operator.

## Install

From the project root:

```bash
npx air-skill install
```

The installer lists detected agents first and pre-checks them. Space toggles. Enter confirms. Then it asks project vs global and shows the dests for the agents you picked. Reload the harness and type `/air`.

CI / no TTY:

```bash
npx air-skill install -y
npx air-skill install --providers=cursor,claude --scope global
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
npx air-skill detect --json
npx air-skill keys --env sandbox
npx air-skill jwks --check https://<origin>/api/.well-known/jwks
```

Docs MCP (optional, complementary): `https://docs.moca.network/mcp`.

## First command

Inside the agent:

```text
/air init
```

Sandbox is the default. The agent asks for role (issuer / verifier / both / account-only / agentic) and a **Partner ID** from [Credential Dashboard → Account → General](https://developers.sandbox.air3.com/). It never invents that UUID.

Issuer path: generate keys locally → show issuer DID → you update the Dashboard / send the activation pack → `/air issue` forks [`air-issuer-service`](https://github.com/MocaNetwork/air-issuer-service) and writes a Next claim UI from the [simulator web](https://github.com/MocaNetwork/air-issuer-service-simulator/tree/main/apps/web) patterns.

Verifier path: no `SEED`, no Nest backend, no activation email. `/air verify` wires the SDK.

## Secrets

`SEED`, `PARTNER_PRIVATE_KEY`, `API_KEY`, and `ADMIN_API_KEY` are written to gitignored `.env.local`. The skill prints the issuer DID only. Never commit those files. Never put them under `NEXT_PUBLIC_*`.

Sandbox and mainnet are separate partners, DIDs, and programs.

## Commands

Setup: `/air`, `init`, `provision`, `keys`, `register`  
Build: `account`, `schema`, `issue`, `verify`, `agent`  
Harden: `audit`, `polish`, `document`

## Related

| Piece | Role |
| --- | --- |
| This repo | Integration skill — context files, commands, detectors |
| [docs.moca.network](https://docs.moca.network) / MCP | Live API and dashboard docs |
| [air-agentic-wallet-skill](https://github.com/MocaNetwork/air-agentic-wallet-skill) | Agent-sign and verify-by-agent scripts |
