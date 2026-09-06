import { SignJWT } from "jose";

const partnerId = "11111111-1111-1111-1111-111111111111";

export async function issueCredential(key: CryptoKey) {
  return new SignJWT({ partnerId, scope: "issue" })
    .setProtectedHeader({ alg: "ES256", kid: partnerId, typ: "JWT" })
    .setExpirationTime(5 * 60)
    .sign(key);
}

export function generateCredentialData() {
  return {
    credentialSubject: {
      is_member: true,
      tier: "gold",
    },
  };
}
