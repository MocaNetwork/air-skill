const partnerId = "11111111-1111-1111-1111-111111111111";

export async function GET() {
  return { keys: [{ kid: partnerId, use: "sig", alg: "ES256" }] };
}
