# /air agent

Do **not** copy agent-sign or UserOp scripts into this skill.

```bash
npx skills add MocaNetwork/air-agentic-wallet-skill
```

That repo ships:

- `air-agentic-wallet` — `POST /v2/wallet/agent-sign`, ERC-4337 UserOps
- `moca-credential-verifier` — scoped sessions, `verify-by-agent`

## Rules (from that skill, restated)

- Always call AIR's `airApiAgentSignUrl`. **Never call Privy directly.**
- Generate a fresh `signedMessage` every request.
- Treat `signedMessage` and `agentSignature` as different signatures.
- Record the handoff bundle in `.air-wallet-config.json` in the project, not inside this skill.

If the user also needs ordinary issue/verify UI, stay in `/air issue` and `/air verify` for the app, and let the wallet skill operate the agent key.
