# No-argument routing

Read this when the user invokes `/air` with no argument. They are asking what to do next. Never auto-run a command.

`context.mjs` has already run. If it printed `NO_PARTNER_MD`, lead with `/air init` and still show the Commands table from SKILL.md.

Otherwise read the JSON from `node <skill-base-dir>/scripts/context.mjs --json` and lead with the **2–3 highest-value next commands**, each with a one-line reason. Then show the full command table grouped Setup / Build / Harden.

Use the printed `recommendations` array. If you reason further, keep this order:

1. No `PARTNER.md` → init
2. Issuer role, Partner ID set, no keys / no JWKS route → keys then audit
3. Keys present, issuer not activated → register
4. Activated, no `issueCredential` / `/issue-vc` → issue
5. Issue exists, verify missing, role is verifier or both → verify
6. Code present → audit then polish
7. Role `account-only` → account (warn that login ≠ issue/verify)
8. Role `agentic` → agent (install the wallet skill)

Keep it to 2–3 pointed picks with the exact command to type. The menu is the fallback.
