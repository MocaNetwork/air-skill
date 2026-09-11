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
  echo "  - Issuer DID (from PARTNER.md / issuer-did.mjs repl — not an HTTP route)"
  echo "  - JWKS URL registered in Dashboard -> Account -> General -> JWKS URL"
  echo "  - Available VC API / Issue VC API URLs on the Dashboard"
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

# --- jwks route (liveness) ----------------------------------------------
ISSUER_BODY=$(curl -fsS --max-time 15 "$BACKEND/.well-known/jwks" 2>/dev/null)
ISSUER=$(json_str "$ISSUER_BODY" issuer)
if [ -n "$ISSUER" ]; then
  pass "GET /.well-known/jwks issuer=$ISSUER"
else
  fail "GET /.well-known/jwks returned no issuer"
  note "Start the backend (pnpm run start) and confirm ISSUER_ORIGIN + SD_JWT_JWKS."
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
     note "Replace ISSUER_ORIGIN with that public origin before a real claim,"
     note "or issued credentials carry a status URL nobody can reach." ;;
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
  note "Check SD_JWT_JWKS on the web app."
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
  note "Check PARTNER_PRIVATE_KEY_DER and PARTNER_PRIVATE_KEY_KID."
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
