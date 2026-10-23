interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_INDEXABLE?: 'true' | 'false';
  readonly PUBLIC_CONTACT_FORM?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
