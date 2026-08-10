/*
  WebAuthn RP ID (issue #12).

  Passkeys are scoped to their RP ID. Using the full hostname means a passkey
  enrolled on www.usezappr.xyz will not resolve on usezappr.xyz (and vice
  versa). WebAuthn allows the RP ID to be a registrable SUFFIX of the origin,
  so production pins the registrable domain via NEXT_PUBLIC_RP_ID
  (usezappr.xyz) — valid on the apex and every subdomain.

  The configured RP ID only applies when it actually covers the current
  origin. On a foreign origin — the legacy zappr-indol.vercel.app alias
  serves the SAME production build, where usezappr.xyz can never be a valid
  RP ID — the browser would hard-fail every ceremony ("relying party ID is
  not a registrable domain suffix"). Falling back to the hostname keeps
  those origins working with their own (separate, origin-scoped) passkeys.

  ⚠ ONE-WAY DOOR: changing the effective RP ID orphans passkeys enrolled
  under the old value. Do it before onboarding real users (we are pre-launch).
*/
export function rpId(): string {
  const host = window.location.hostname;
  const configured = process.env.NEXT_PUBLIC_RP_ID;
  if (!configured) return host;
  if (host === configured || host.endsWith('.' + configured)) return configured;
  return host;
}
