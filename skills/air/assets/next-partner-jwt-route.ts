import { NextResponse } from "next/server";
import * as jose from "jose";

function wrapPrivateKeyPem(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

export async function POST() {
  const privateKeyBody = process.env.PARTNER_PRIVATE_KEY;
  const algorithm = process.env.SIGNING_ALGORITHM;
  const partnerId = process.env.NEXT_PUBLIC_PARTNER_ID;

  if (!privateKeyBody || !algorithm || !partnerId) {
    return NextResponse.json({ error: "Missing partner key configuration" }, { status: 500 });
  }

  const privateKey = await jose.importPKCS8(wrapPrivateKeyPem(privateKeyBody), algorithm);
  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({ partnerId, scope: "issue" })
    .setProtectedHeader({ alg: algorithm, kid: partnerId, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(privateKey);

  return NextResponse.json({ token });
}
