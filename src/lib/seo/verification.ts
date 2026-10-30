/**
 * Optional search-engine ownership meta tags (Search Console "HTML tag" method, Bing Webmaster Tools).
 * Each tag renders only when its PUBLIC_ env var is set to a plausible token; otherwise nothing is emitted.
 */

export interface VerificationEnv {
  PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  PUBLIC_BING_SITE_VERIFICATION?: string;
}

export interface VerificationTag {
  name: 'google-site-verification' | 'msvalidate.01';
  content: string;
}

/** Tokens are URL-safe strings (letters, digits, `_`, `-`); anything else is ignored rather than rendered. */
const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

export function verificationTags(env: VerificationEnv): VerificationTag[] {
  const tags: VerificationTag[] = [];
  const google = env.PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = env.PUBLIC_BING_SITE_VERIFICATION?.trim();
  if (google && TOKEN.test(google)) tags.push({ name: 'google-site-verification', content: google });
  if (bing && TOKEN.test(bing)) tags.push({ name: 'msvalidate.01', content: bing });
  return tags;
}

/** Names of verification vars that are set (non-blank) but not a valid token, so the build can warn. */
export function invalidVerificationVars(env: VerificationEnv): string[] {
  const names = ['PUBLIC_GOOGLE_SITE_VERIFICATION', 'PUBLIC_BING_SITE_VERIFICATION'] as const;
  return names.filter((name) => {
    const value = env[name]?.trim();
    return !!value && !TOKEN.test(value);
  });
}
