import { SignJWT } from "jose";

export async function issueCredential(key: CryptoKey) {
  await fetch("https://api.sandbox.mocachain.org/v1/dstorage/vcs", {
    headers: { "x-api-key": "nope" },
  });
  const token = await new SignJWT({ partnerId: "x" })
    .setProtectedHeader({ alg: "ES256", kid: "frontendKid", typ: "JWT" })
    .setExpirationTime(60 * 60)
    .sign(key);
  return token;
}

export function generateCredentialData() {
  return {
    credentialSubject: {
      dob: "1990-01-01",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
    },
  };
}
