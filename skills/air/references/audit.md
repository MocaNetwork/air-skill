# /air audit

Deterministic checks first. No LLM for the scan.

```bash
node <skill-base-dir>/scripts/detect.mjs --json
# or
npx air-dev-skill detect --json
```

Severity: **P0** = credentials will not issue. Fix P0 before anything else.

Then, if origins are up:

```bash
sh <skill-base-dir>/scripts/preflight.sh https://<backend> https://<web>
```

Preflight checks `/ready`, issuer DID, credential-status reachability, JWKS `kid`, and Partner JWT `kid` match.

## What detect cannot see

- Dashboard JWKS URL registration
- Domain whitelist
- AIR team activation

Those stay on [register.md](register.md).

Report findings as P0–P3 with file and message. Do not print secret values.
