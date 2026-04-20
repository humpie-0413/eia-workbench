export async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!r.ok) return false;
  const j = (await r.json()) as { success: boolean };
  return j.success === true;
}
