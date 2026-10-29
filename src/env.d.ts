interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_INDEXABLE?: 'true' | 'false';
  /** Search Console HTML-tag verification token (the `content` value); renders nothing when unset. */
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  /** Bing Webmaster Tools `msvalidate.01` token; renders nothing when unset. */
  readonly PUBLIC_BING_SITE_VERIFICATION?: string;
  readonly PUBLIC_CONTACT_FORM?: 'true' | 'false';
  /** Include draft content records (dev/e2e only; never for live). */
  readonly PUBLIC_INCLUDE_DRAFTS?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
