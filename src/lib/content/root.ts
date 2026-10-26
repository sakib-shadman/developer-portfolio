/**
 * Where content comes from (issue #17). `PUBLIC_CONTENT_FIXTURES=true` swaps src/content for the
 * fictional, fully populated tests/fixtures/content so e2e can cover blog, case studies, photo,
 * resume and email, none of which exist in real content yet. Pure so the guards are unit-tested.
 */
export const REAL_CONTENT = 'src/content';
export const FIXTURE_CONTENT = 'tests/fixtures/content';
export const REAL_PUBLIC = 'public';
export const FIXTURE_PUBLIC = 'tests/fixtures/public';
/** Present in the fixture profile; must never appear in real content (see `fixtureLeak`). */
export const FIXTURE_MARKER = '(fixture)';

export type BuildEnv = Partial<
  Record<'PUBLIC_CONTENT_FIXTURES' | 'PUBLIC_INDEXABLE' | 'PUBLIC_INCLUDE_DRAFTS', string | undefined>
>;

export const fixturesOn = (flag: string | undefined): boolean => flag === 'true';
export const contentRoot = (flag: string | undefined): string =>
  fixturesOn(flag) ? FIXTURE_CONTENT : REAL_CONTENT;
/** Directory whose files must exist for `profile.resume` (fixtures ship their own PDF). */
export const publicRoot = (flag: string | undefined): string =>
  fixturesOn(flag) ? FIXTURE_PUBLIC : REAL_PUBLIC;

/** True when text from real content carries the fixture marker (fixtures leaked into src/content). */
export const fixtureLeak = (text: string): boolean => text.includes(FIXTURE_MARKER);

/** Returns the reason a build must be refused, or undefined when the flag combination is safe. */
export function buildFlagError(env: BuildEnv): string | undefined {
  if (env.PUBLIC_INCLUDE_DRAFTS === 'true' && env.PUBLIC_INDEXABLE === 'true')
    return 'Refusing to build: PUBLIC_INCLUDE_DRAFTS=true with PUBLIC_INDEXABLE=true';
  if (fixturesOn(env.PUBLIC_CONTENT_FIXTURES) && env.PUBLIC_INDEXABLE === 'true')
    return 'Refusing to build: PUBLIC_CONTENT_FIXTURES=true with PUBLIC_INDEXABLE=true';
  return undefined;
}
