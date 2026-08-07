# Onboarding: issuer DID, API key, and partner credentials

Run this before writing any code. Nothing downstream works without these
values, and most of them can only be produced by the user or by the AIR team.

## Step A — Audit what already exists

Check before asking. Repeating questions the user has already answered wastes
their time; assuming values they never gave you produces a stack that fails at
the first real claim.

Inspect the working project for each value below — look in `.env`,
`.env.local`, deployment configuration, and any secrets manager the project
uses. Report presence or absence only.

**Never print a secret value into the chat, a log, a commit, or a summary.**
For `SEED`, `PARTNER_PRIVATE_KEY_DER`, `PARTNER_PRIVATE_KEY`, `API_KEY`, and
`ADMIN_API_KEY`, confirm only that the variable is set and non-placeholder.
Values still equal to the `.env.example` defaults count as missing — the
examples ship with a real-looking seed that is not yours.

| Value | Typical variable | Where it comes from |
| --- | --- | --- |
| Issuer seed | `SEED` | You generate it. Never shared |
| Issuer DID | derived, not stored | Derived from the seed; read from the running backend |
| API key | `API_KEY` | You generate it. Shared with AIR |
| Admin API key | `ADMIN_API_KEY` | You generate it. Never shared |
| Partner ID | `PARTNER_ID`, `NEXT_PUBLIC_PARTNER_ID` | Dashboard → Account → General |
| Partner private key | `PARTNER_PRIVATE_KEY_DER` (backend), `PARTNER_PRIVATE_KEY` (web) | You generate it. Never shared |
| Partner public key | `PARTNER_PUBLIC_KEY` (web) | Derived from the private key; published as JWKS |
| Key id | `PARTNER_PRIVATE_KEY_KID` | You choose it. Must match the JWKS `kid` |
| Signing algorithm | `PARTNER_PRIVATE_KEY_ALG`, `SIGNING_ALGORITHM` | `ES256` or `RS256`. Must match the key type |
| Schema ID, type, schema URL, context URL | in the schema class | Dashboard → Issuer → Schemas |
| Issuance program ID | `NEXT_PUBLIC_ISSUE_PROGRAM_ID` | Dashboard → Issuer → Programs |
| Issuer backend URL | `ISSUER_ORIGIN` | Your public HTTPS deployment or tunnel |
| AIR API origin | `AIR_API_ORIGIN` | AIR team |
| Moca chain API origin | `MOCA_CHAIN_API_ORIGIN` | AIR team |
| JWKS URL registered | not an env var | Dashboard → Account → General → JWKS URL |
| Domain whitelisted | not an env var | Dashboard → Domains |
| AIR activation done | not an env var | Confirmed by the AIR team |

Summarize the audit as three groups before doing anything else:

1. **Present** — named, not printed.
2. **Missing but you can generate** — seed, API keys, partner keypair. Offer to
   generate them now.
3. **Missing and only the user can supply** — everything sourced from the
   Dashboard or the AIR team.

If group 3 is empty, skip to the build steps. If it is not empty, go to Step B.

## Step B — If details are missing, give the user these steps

Relay the following to the user as-is. Do not paraphrase it, and do not drop
steps they may already have done — they need the whole sequence to check
against.

> This is necessary in order to have issuerDID, api key and rest of the keys
> To get started, please follow the steps below.
>
> **1. Create a new sandbox account**
>
> For this integration, we recommend creating a new account rather than reusing
> the previous setup. This will help keep the new configuration clean and
> isolated.
>
> Credential Dashboard:
> https://developers.sandbox.air3.com/
>
> **2. Review the updated issuance documentation**
>
> We've refreshed our documentation and added a complete guide covering the new
> credential issuance flow:
>
> https://docs.moca.network/airkit/quickstart/issue-credentials
>
> **3. Choose a reference implementation**
>
> Sharing with you two repositories:
>
> AIR Issuer Service Simulator
> https://github.com/MocaNetwork/air-issuer-service-simulator
>
> This is a lightweight monorepo containing both frontend and backend examples,
> which makes it easier to understand the complete integration flow.
>
> AIR Issuer Service
> https://github.com/MocaNetwork/air-issuer-service
>
> This is a more comprehensive implementation that you can use also in order to
> retrieve API key and issuerDID. (This is temporary solution and we're already
> working on a new structure to make integration way more easier)
>
> **4. Prepare your issuer setup**
>
> Once you've cloned air-issuer-service, please:
>
> Generate your issuer seed.
> Retrieve your Issuer DID.
> Generate an API key.
> Deploy or expose your issuer backend through a publicly accessible HTTPS URL.
> whitelist your domain on credential dashboard
>
> P.S In air-issuer-service/bin folder you can find "generate-secrets" script
> that can help you to retrieve necessary keys
>
> Once you've collected all the keys, setup your .env environment with
> respective keys and run
> `echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -`
>
> Please keep the issuer seed securely on your backend. It should not be shared
> with us, exposed in frontend code, or committed to a repository.
>
> **5. Share the configuration details with us**
>
> Once the setup is complete, please send us the following:
>
> Issuer DID
> API Key
> Partner ID
> Issuer Backend URL
>
> After receiving these details, we'll complete the required configuration and
> activation on our side.

Two clarifications to offer alongside it:

- "Retrieve your Partner" means the **Partner ID**, the UUID under
  Dashboard → Account → General.
- Steps 1, 4 (deploy and whitelist), and 5 need a human. Steps 3 and the key
  generation in step 4 you can do for them.

Then ask for exactly what is in group 3 of your audit, in one message rather
than one question at a time.

## Step C — Generate the secrets

`bin/generate-secrets` in `air-issuer-service` produces most of the backend
secrets in one shot. It is a plain Node script with no dependencies, so it runs
straight from a clone:

```bash
git clone --depth 1 https://github.com/MocaNetwork/air-issuer-service.git
cd air-issuer-service
node bin/generate-secrets
```

It prints, ready to paste into `.env`:

| Output | What it is |
| --- | --- |
| `SEED` | 32 random bytes, hex, `0x`-prefixed. Determines the issuer DID |
| `PARTNER_PRIVATE_KEY_KID` | A random UUID used as the JWKS key id |
| `PARTNER_PRIVATE_KEY_DER` | An EC P-256 private key, PKCS#8, base64 |
| `SD_JWT_JWKS` | The matching public JWK, `alg: ES256` |
| `API_KEY` | 32 random bytes, hex. This is what you share with AIR |
| `ADMIN_API_KEY` | 32 random bytes, hex. Never shared |

Because the key is **EC P-256**, set `PARTNER_PRIVATE_KEY_ALG=ES256` on the
backend and `SIGNING_ALGORITHM=ES256` on the web app. Leaving either at `RS256`
fails at key import, usually at boot rather than at first use.

Redirect the output to a file rather than pasting through the chat:

```bash
node bin/generate-secrets >> .env
```

Confirm `.env` is gitignored before writing to it.

### Keep the `kid` consistent

This trips up most integrations. There is only **one** JWKS URL registered in
the Dashboard, but two components sign Partner JWTs against it:

- the backend, signing with `PARTNER_PRIVATE_KEY_KID`
- the web app, signing with whatever `kid` its Partner JWT route sets — in the
  simulator that is the Partner ID

Every `kid` you sign with must appear in the JWKS you publish, or AIR returns
401. The simplest arrangement is one keypair and one `kid` everywhere: pick a
single value, set `PARTNER_PRIVATE_KEY_KID` to it, publish it as the JWKS
`kid`, and have the web app's JWT route use the same string. Using the Partner
ID keeps it memorable; the UUID from `generate-secrets` works equally well as
long as all three agree.

The backend needs the private key as DER/PKCS#8 base64; the web app needs the
same key plus its public half, both as bare base64 bodies without PEM headers.
The web app's `PARTNER_PRIVATE_KEY` is the same base64 the script printed for
`PARTNER_PRIVATE_KEY_DER`. Derive `PARTNER_PUBLIC_KEY` from it:

```bash
DER=$(grep '^PARTNER_PRIVATE_KEY_DER=' .env | sed 's/^PARTNER_PRIVATE_KEY_DER=//')

printf -- '-----BEGIN PRIVATE KEY-----\n%s\n-----END PRIVATE KEY-----\n' "$DER" \
  | openssl pkey -pubout \
  | sed '1d;$d' | tr -d '\n'
```

That prints the public key body on one line, ready to paste as
`PARTNER_PUBLIC_KEY` in the web app's `.env.local`.

## Step D — Read the issuer DID

The DID is derived from `SEED` plus `IDEN3_METHOD`, `IDEN3_BLOCKCHAIN`, and
`IDEN3_NETWORK_ID`, so it only exists once `.env` is filled in. Two ways to get
it:

```bash
# From a running backend (also works as a health check):
curl -s $ISSUER_ORIGIN/.well-known/issuer-did

# From the repl, without deploying:
echo 'console.log(get(CredentialIssuingService).issuerDID.string());' | pnpm run repl -
```

It is also logged at every boot as `[CredentialIssuingService] Issuer DID: ...`.

The repl route needs a working `.env`, and in `air-issuer-service` a reachable
`DATABASE_URL`. If the repl will not start, fix the boot error first — a DID
that cannot be produced locally cannot be registered.

## Step E — Hand off and record

Confirm the user has sent the AIR team all four:

- Issuer DID
- API Key
- Partner ID
- Issuer Backend URL

And that they have done the two self-serve Dashboard steps themselves:
register the JWKS URL under Account → General, and whitelist the domain.

Record which values are outstanding so the next session does not re-ask. A
short non-secret note in the project — a `docs/` file or a filled `.env.example`
with placeholder names but no values — is enough.

Until AIR confirms activation, expect the backend to return 403 on
`/available-vc` and `/issue-vc` with no controller logs. That is the guard
rejecting a missing or mismatched `x-api-key`, not a bug in your code.

## Security rules

- The issuer seed stays on the backend. Never shared with AIR, never in
  frontend code, never committed.
- Share only the API key, Partner ID, issuer DID, and backend URL. The admin
  API key and all private keys stay with you.
- Never print secret values into chat output, terminal transcripts, commit
  messages, or PR descriptions.
- Confirm `.env` is gitignored before writing generated secrets into it.
- If a secret was committed or pasted anywhere shared, treat it as burned and
  regenerate — except the seed, which cannot be rotated without a new issuer
  registration. A leaked seed needs a conversation with the AIR team.
