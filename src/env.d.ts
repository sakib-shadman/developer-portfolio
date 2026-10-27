interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_INDEXABLE?: 'true' | 'false';
  readonly PUBLIC_CONTACT_FORM?: 'true' | 'false';
  /** Include draft content records (dev/e2e only; never for live). */
  readonly PUBLIC_INCLUDE_DRAFTS?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
