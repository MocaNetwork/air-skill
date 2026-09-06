# /air verify

Verifier-only apps skip `SEED`, issuer backend, `API_KEY`, and the activation email. They still need a Partner ID and, if they sign Partner JWTs, a public HTTPS JWKS.

## SDK path (default)

```ts
await air.verifyCredential({
  authToken,          // Partner JWT; scope as required by the verify API
  programId: process.env.NEXT_PUBLIC_VERIFY_PROGRAM_ID!,
});
```

Program ID comes from Dashboard → Verifier → Programs. Same network as the issuer. Testnet credentials are invisible on mainnet.

Selective disclosure: holders reveal a subset of fields. See `/airkit/early-access/selective-disclosure` when the task needs it.

## Agent path

`POST /credentials/verify-by-agent` (query_match). Do not reimplement. Load [agent.md](agent.md) and reuse `moca-credential-verifier` scripts from `npx skills add MocaNetwork/air-agentic-wallet-skill`.

## Checklist

```bash
node <skill-base-dir>/scripts/verify.mjs --check
```

Then implement `verifyCredential` in the existing app, or a small Next page that logs in and runs the program. No Nest fork.

Record program IDs in PARTNER.md via `provision.mjs write-ids --verify-program-id`.
