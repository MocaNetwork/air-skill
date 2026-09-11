import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.SD_JWT_JWKS;
  if (!raw) {
    return NextResponse.json({ error: "Missing SD_JWT_JWKS" }, { status: 500 });
  }

  try {
    const jwks = JSON.parse(raw);
    return NextResponse.json(jwks, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "SD_JWT_JWKS is not valid JSON" }, { status: 500 });
  }
}
