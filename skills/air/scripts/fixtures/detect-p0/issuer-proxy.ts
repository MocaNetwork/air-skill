export async function proxyAvailableVc() {
  await fetch("https://issuer.example.com/available-vc", {
    headers: { "x-partner-auth": "jwt" },
  });
}
