# No-argument routing

Read this when the user invokes `/air` with no argument. They are asking what to do next. Never auto-run a command.

`context.mjs` has already run. If it printed `NO_PARTNER_MD`, lead with `/air init` and still show the Commands table from SKILL.md.

Otherwise read the JSON from `node <skill-base-dir>/scripts/context.mjs --json` and lead with the **2–3 highest-value next commands**, each with a one-line reason. Then show the full command table grouped Setup / Build / Harden.

Use the printed `recommendations` array. If you reason further, keep this order:

1. No `PARTNER.md` → init
2. Issuer role, no cloned backend → issue (`--clone-backend --install`)
3. Existing partner, backend present, no `SEED` → keys `--import`
4. New partner, backend present, no `SEED` → keys
5. Keys present, issuer DID missing → issuer-did
6. DID present, issuer not activated → register
7. Activated, no `issueCredential` → issue (frontend / schema)
8. Issue exists, verify missing, role is verifier or both → verify
9. Code present → audit then polish
10. Role `account-only` → account (warn that login ≠ issue/verify)
11. Role `agentic` → agent (install the wallet skill)

Keep it to 2–3 pointed picks with the exact command to type. The menu is the fallback.
