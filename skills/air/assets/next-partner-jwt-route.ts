import { NextResponse } from "next/server";
import * as jose from "jose";

function wrapPrivateKeyPem(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

export async function POST() {
  const privateKeyBody = process.env.PARTNER_PRIVATE_KEY_DER;
  const partnerId = process.env.NEXT_PUBLIC_PARTNER_ID || process.env.PARTNER_ID;
  const kid = process.env.PARTNER_PRIVATE_KEY_KID || partnerId;
  const algorithm = "ES256";

  if (!privateKeyBody || !partnerId || !kid) {
    return NextResponse.json({ error: "Missing partner key configuration" }, { status: 500 });
  }

  const privateKey = await jose.importPKCS8(wrapPrivateKeyPem(privateKeyBody), algorithm);
  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({ partnerId, scope: "issue" })
    .setProtectedHeader({ alg: algorithm, kid, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(privateKey);

  return NextResponse.json({ token });
}
