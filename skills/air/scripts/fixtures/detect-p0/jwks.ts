export async function GET() {
  return {
    keys: [{ kid: "jwksKid", use: "sig", alg: "ES256" }],
  };
}
