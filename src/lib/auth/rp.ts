/*
  WebAuthn RP ID (issue #12).

  Passkeys are scoped to their RP ID. Using the full hostname means a passkey
  enrolled on www.usezappr.xyz will not resolve on usezappr.xyz (and vice
  versa). WebAuthn allows the RP ID to be a registrable SUFFIX of the origin,
  so production pins the registrable domain via NEXT_PUBLIC_RP_ID
  (usezappr.xyz) — valid on the apex and every subdomain.

  Fallback to the hostname keeps localhost and *.vercel.app previews working:
  vercel.app is on the public-suffix list, so it can never be an RP ID there.

  ⚠ ONE-WAY DOOR: changing the RP ID orphans passkeys enrolled under the old
  value. Do it before onboarding real users (we are pre-launch).
*/
export function rpId(): string {
  return process.env.NEXT_PUBLIC_RP_ID || window.location.hostname;
}
