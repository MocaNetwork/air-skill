# Troubleshooting

Indexed by what you observe. Run `scripts/preflight.sh` first — it catches most
of the configuration failures below before you spend time reading logs.

## The backend returns 403 and no controller logs appear

The API key guard rejected the request before any handler ran. Either AIR is not
sending `x-api-key`, or the value does not match the backend's `API_KEY`.

Almost always this means the AIR team has not finished whitelisting. Confirm all
four items were sent and acknowledged: issuer DID, `API_KEY`, Partner ID, and
the full HTTPS URLs for `/available-vc` and `/issue-vc`. Verify the key locally:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<backend>/available-vc \
  -H 'content-type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"holderDID":"did:air:test","pubKey":"0x00","userId":"probe"}'
```

A 403 there means your own key is wrong. Anything else means the key is fine and
the problem is on the AIR side.

## `issueCredential` fails with 401

AIR could not validate your Partner JWT. Check in this order:

1. Is the JWKS URL registered in Dashboard → Account → General → JWKS URL, and
   is it the exact URL your app serves?
2. Is that URL public HTTPS? AIR cannot reach `localhost` or a private IP.
3. Does `keys[].kid` in the JWKS match the `kid` in the JWT header?
4. Does the JWKS `alg` match `SIGNING_ALGORITHM`?
5. Has the token expired? They are five-minute tokens; fetch a fresh one per
   call.

Decode the header you are actually sending:

```bash
curl -s -X POST https://<web>/api/partner-jwt | jq -r .token \
  | cut -d. -f1 | base64 -d 2>/dev/null | jq .
curl -s https://<web>/api/.well-known/jwks | jq '.keys[].kid'
```

The two `kid` values must be identical strings.

Remember the backend signs Partner JWTs too, with `PARTNER_PRIVATE_KEY_KID`,
and AIR validates those against the same single JWKS URL. If the backend's kid
differs from the one your JWKS publishes, backend-initiated calls fail even
though the frontend works. The simplest fix is one keypair and one kid shared
by both apps.

## `Error create w3c credential must match format "uri"`

`credentialSubject.id` was set to something that is not a URI — usually an email
or a `userId`.

The framework sets `id` to the holder DID after spreading your subject. If
`generateCredentialData` returns an `id`, and the spread happens after the
assignment, your value wins and validation fails. Remove `id` from the schema
class entirely, and confirm the base class spreads first and assigns `id` last:

```ts
credentialSubject: {
  ...data.credentialSubject,  // claims only
  id: opts.holderDID,         // always last
},
```

## The service will not start

| Message or symptom | Cause |
| --- | --- |
| Refuses to boot, mentions the database | `DATABASE_URL` missing, or a JDBC URL where a `postgres://` URL is required |
| Fails importing a key at startup | `PARTNER_PRIVATE_KEY_DER` is not parseable PKCS#8. It is imported at boot even if you never issue SD-JWT credentials |
| Key import fails despite a valid key | Algorithm mismatch. `bin/generate-secrets` emits an EC P-256 key, which needs `ES256`; an RSA key needs `RS256`. The same applies to `SIGNING_ALGORITHM` on the web app |
| Boots but `/ready` returns 503 | Read `checks` in the response body — it names the failing subsystem |

## The repl will not start

`echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -`
boots the full Nest application, so it fails for the same reasons the service
fails: a missing `.env` value, an unparseable partner key, or an unreachable
`DATABASE_URL`. Fix the boot error first. A DID you cannot produce locally is a
DID you cannot register.

## `/ready` reports pending migrations

```bash
pnpm migration:up
```

Then re-check. `checks.migrations.pending` lists the exact migration names still
unapplied.

## The issuer DID does not match the Dashboard

The DID is derived from `SEED` plus `IDEN3_METHOD`, `IDEN3_BLOCKCHAIN`, and
`IDEN3_NETWORK_ID`. A mismatch means one of those four differs from what was
registered — most often the seed was regenerated, or one project is on
`testnet` while another defaults elsewhere.

Do not rotate `SEED` to fix this. Restore the original seed and env values. If
the seed is genuinely lost, you need a new registration with the AIR team.

Compare what each component reports before assuming:

```bash
curl -s https://<backend>/.well-known/issuer-did | jq -r .did
```

## Verification fails even though issuance succeeded

Usually a type mismatch between the schema class and the Dashboard schema. A
string where the schema declares a number breaks merklization, and nothing
complains until a verifier tries to check the proof. Compare every key and type
in `generateCredentialData` against the published schema.

Also check `credentialStatus`: if `ISSUER_ORIGIN` was wrong or not publicly
reachable when the credential was issued, the embedded status URL is dead and
non-revocation checks fail. Fix the origin and re-issue — existing credentials
keep the bad URL.

## Credentials issued earlier are missing

Credentials are network-specific. Anything issued on Testnet is invisible on
Mainnet, and vice versa. Confirm `BUILD_ENV` and the Dashboard you are looking
at refer to the same network, and re-issue on the target network if you
migrated.

## The Dashboard has no Issuer or Verifier menu

Credential services are gated until AIR registers your issuer DID against the
partner account. Generate the seed, boot the backend, read
`/.well-known/issuer-did`, and send the DID to the AIR team. The menus appear
after they register it.

## AIR cannot reach the backend at all

- Is `ISSUER_ORIGIN` the current public HTTPS origin, with no trailing slash?
  Tunnel URLs change on restart unless the tunnel is named.
- Was the backend restarted after `ISSUER_ORIGIN` changed?
- If CORS is enabled on the backend or a proxy in front of it, is `*.air3.com`
  allowed? Restricting to your own domain breaks the claim flow.
- Do the URLs whitelisted with the AIR team still point at the live tunnel?

## Still stuck

Read `/airkit/troubleshooting/credential-issues` and
`/airkit/troubleshooting/common-errors` on `https://docs.moca.network`, then
compare your code against the current reference implementation:

```bash
curl -s "https://api.github.com/repos/MocaNetwork/air-issuer-service-simulator/git/trees/main?recursive=1" \
  | jq -r '.tree[] | select(.type=="blob") | .path'
curl -s https://raw.githubusercontent.com/MocaNetwork/air-issuer-service-simulator/main/<path>
```

When you report back to the user, say which check failed and what the fix is,
not just that something failed.
