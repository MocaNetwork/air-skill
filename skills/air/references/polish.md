# /air polish

Last-mile before a real claim. Read detect output first; polish does not replace audit.

- **Fresh JWT per call.** Five-minute tokens. Reuse across a session looks like flaky 401s.
- **Poll until ONCHAIN** if the SDK/docs say the credential is not usable at `PENDING`.
- **CORS** on the issuer or its proxy: allow `*.air3.com`.
- **Session gate** on `POST /api/partner-jwt` in production — the stub mints an issue-scoped token for anyone who can reach it.
- **Errors:** map 401 → JWKS/kid/exp ([auth.md](auth.md)); 403 on issuer → activation / `x-api-key`; `must match format "uri"` → `credentialSubject.id`.
- **Tunnels:** named tunnels or `ISSUER_ORIGIN` goes stale and revocation URLs die.
- **Env split:** re-run `detect.mjs` after edits.

Do not add custom-auth, paymaster, or CAK during polish unless `PARTNER.md` already committed to them.
