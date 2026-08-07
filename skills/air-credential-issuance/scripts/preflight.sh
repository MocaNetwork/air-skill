#!/bin/sh
# Verify an AIR issuer deployment before attempting a credential claim.
#
# Usage: sh preflight.sh <backend-origin> [web-origin]
#   sh preflight.sh http://localhost:3000 http://localhost:3001
#   sh preflight.sh https://issuer.example.com https://app.example.com
#
# Exits non-zero if any check fails. Requires curl; uses jq when available.

set -u

BACKEND="${1:-}"
WEB="${2:-}"
FAILED=0
WARNED=0

if [ -z "$BACKEND" ]; then
  echo "usage: sh preflight.sh <backend-origin> [web-origin]" >&2
  exit 2
fi

BACKEND="${BACKEND%/}"
WEB="${WEB%/}"

have_jq() { command -v jq >/dev/null 2>&1; }

pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILED=$((FAILED + 1)); }
warn() { printf '  warn  %s\n' "$1"; WARNED=$((WARNED + 1)); }
note() { printf '        %s\n' "$1"; }

summarize() {
  echo
  [ "$FAILED" -gt 0 ] && echo "$FAILED check(s) failed."
  [ "$WARNED" -gt 0 ] && echo "$WARNED warning(s) — not blocking locally, but blocking for a real claim."
  [ "$FAILED" -eq 0 ] && [ "$WARNED" -eq 0 ] && echo "All checks passed."
  echo
  echo "Steps this script cannot verify:"
  echo "  - JWKS URL registered in Dashboard -> Account -> General -> JWKS URL"
  echo "  - Web origin whitelisted under Dashboard -> Domains"
  echo "  - AIR team whitelisted the issuer DID, API key, Partner ID, and backend URLs"
  [ "$FAILED" -eq 0 ] && exit 0
  exit 1
}

# First value of a JSON string field. Splitting on commas keeps a greedy `.*`
# from skipping ahead to a same-named key nested later in the document.
json_str() {
  printf '%s' "$1" | tr ',' '\n' \
    | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -1
}

echo "Backend: $BACKEND"

# --- readiness -------------------------------------------------------------
# No -f here: /ready answers 503 when not ready, and that body names the
# failing subsystem. Discarding it would throw away the useful part.
READY_BODY=$(curl -sS --max-time 15 "$BACKEND/ready" 2>/dev/null)
if [ -z "$READY_BODY" ]; then
  fail "GET /ready returned nothing — the service is not running or not reachable"
  note "Start the backend and re-run."
else
  STATUS=$(json_str "$READY_BODY" status)
  if [ "$STATUS" = "ready" ]; then
    pass "GET /ready reports ready"
  else
    fail "GET /ready reports status=${STATUS:-unknown}"
    if have_jq; then
      printf '%s' "$READY_BODY" | jq -c '.checks // .' 2>/dev/null | sed 's/^/        /'
    else
      note "$READY_BODY"
    fi
    case "$READY_BODY" in
      *'"pending"'*[A-Za-z0-9]*) note "Pending migrations listed above. Run: pnpm migration:up" ;;
    esac
  fi
fi

# --- issuer DID ------------------------------------------------------------
DID_BODY=$(curl -fsS --max-time 15 "$BACKEND/.well-known/issuer-did" 2>/dev/null)
DID=$(json_str "$DID_BODY" did)
if [ -n "$DID" ]; then
  pass "issuer DID: $DID"
  note "This exact string must be registered with the AIR team."
else
  fail "GET /.well-known/issuer-did returned no DID"
  note "Check SEED and the IDEN3_* env vars."
fi

# --- credential status route ----------------------------------------------
STATUS_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  "$BACKEND/credential-status/preflight-probe" 2>/dev/null)
if [ "$STATUS_CODE" = "000" ]; then
  fail "GET /credential-status/:nonce is unreachable"
else
  pass "GET /credential-status/:nonce reachable (HTTP $STATUS_CODE)"
fi

case "$BACKEND" in
  https://*) pass "backend is served over HTTPS" ;;
  *) warn "backend is not HTTPS; AIR needs a public HTTPS origin to call it"
     note "ISSUER_ORIGIN must be that public origin, or issued credentials"
     note "carry a status URL nobody can reach." ;;
esac

# --- web app ---------------------------------------------------------------
if [ -z "$WEB" ]; then
  echo
  echo "No web origin given; skipped JWKS and Partner JWT checks."
  summarize
fi

echo
echo "Web: $WEB"

JWKS_BODY=$(curl -fsS --max-time 15 "$WEB/api/.well-known/jwks" 2>/dev/null)
JWKS_KID=$(json_str "$JWKS_BODY" kid)
if [ -n "$JWKS_KID" ]; then
  pass "JWKS served, kid=$JWKS_KID"
else
  fail "GET /api/.well-known/jwks returned no key"
  note "Check PARTNER_PUBLIC_KEY, SIGNING_ALGORITHM, NEXT_PUBLIC_PARTNER_ID."
fi

case "$WEB" in
  https://*) pass "JWKS is served over HTTPS" ;;
  *) warn "JWKS is not HTTPS; AIR cannot fetch it and issueCredential will 401"
     note "Tunnel it, then register the tunnel URL in the Dashboard:"
     note "  cloudflared tunnel --url $WEB" ;;
esac

TOKEN=$(curl -fsS --max-time 15 -X POST "$WEB/api/partner-jwt" 2>/dev/null \
  | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  fail "POST /api/partner-jwt did not return a token"
  note "Check PARTNER_PRIVATE_KEY and that it matches PARTNER_PUBLIC_KEY."
else
  pass "Partner JWT signed"
  HEADER_B64=$(printf '%s' "$TOKEN" | cut -d. -f1)
  # base64url -> base64, pad to a multiple of 4
  HEADER_B64=$(printf '%s' "$HEADER_B64" | tr '_-' '/+')
  while [ $((${#HEADER_B64} % 4)) -ne 0 ]; do HEADER_B64="${HEADER_B64}="; done
  HEADER_JSON=$(printf '%s' "$HEADER_B64" | base64 -d 2>/dev/null || printf '%s' "$HEADER_B64" | base64 -D 2>/dev/null)
  JWT_KID=$(json_str "$HEADER_JSON" kid)
  if [ -n "$JWT_KID" ] && [ -n "$JWKS_KID" ]; then
    if [ "$JWT_KID" = "$JWKS_KID" ]; then
      pass "JWT kid matches the JWKS kid"
    else
      fail "kid mismatch: JWT=$JWT_KID JWKS=$JWKS_KID"
      note "AIR returns 401 when these differ."
    fi
  fi
fi

summarize
