/** Public contact for pilots, support, and "contact us" surfaces. */
export const CONTACT_EMAIL = "ky@getupheld.com";

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

export function contactMailto(subject?: string): string {
  if (!subject?.trim()) return CONTACT_MAILTO;
  return `${CONTACT_MAILTO}?subject=${encodeURIComponent(subject)}`;
}
