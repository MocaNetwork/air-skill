import { NextResponse } from "next/server";
import * as jose from "jose";

function wrapPublicKeyPem(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return `-----BEGIN PUBLIC KEY-----\n${trimmed}\n-----END PUBLIC KEY-----`;
}

export async function GET() {
  const publicKeyBody = process.env.PARTNER_PUBLIC_KEY;
  const algorithm = process.env.SIGNING_ALGORITHM;
  const partnerId = process.env.NEXT_PUBLIC_PARTNER_ID;

  if (!publicKeyBody || !algorithm || !partnerId) {
    return NextResponse.json({ error: "Missing partner key configuration" }, { status: 500 });
  }

  const publicKey = await jose.importSPKI(wrapPublicKeyPem(publicKeyBody), algorithm);
  const jwk = await jose.exportJWK(publicKey);

  return NextResponse.json(
    { keys: [{ ...jwk, kid: partnerId, use: "sig", alg: algorithm }] },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
