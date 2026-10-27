import { describe, expect, it } from 'vitest';
import {
  FIXTURE_CONTENT,
  FIXTURE_MARKER,
  FIXTURE_PUBLIC,
  REAL_CONTENT,
  REAL_PUBLIC,
  buildFlagError,
  distLeaks,
  fixtureFileName,
  contentRoot,
  fixtureLeak,
  fixturesOn,
  publicRoot,
} from '../../src/lib/content/root';

describe('content root selection', () => {
  it('only the exact string "true" turns fixtures on', () => {
    expect(fixturesOn('true')).toBe(true);
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) expect(fixturesOn(v)).toBe(false);
  });
  it('picks content and public roots together', () => {
    expect(contentRoot('true')).toBe(FIXTURE_CONTENT);
    expect(publicRoot('true')).toBe(FIXTURE_PUBLIC);
    expect(contentRoot(undefined)).toBe(REAL_CONTENT);
    expect(contentRoot('false')).toBe(REAL_CONTENT);
    expect(publicRoot('false')).toBe(REAL_PUBLIC);
  });
  it('fixtures live outside src and public so they can never ship by accident', () => {
    expect(FIXTURE_CONTENT.startsWith('tests/')).toBe(true);
    expect(FIXTURE_PUBLIC.startsWith('tests/')).toBe(true);
  });
});

describe('fixtureLeak', () => {
  it('detects the fixture marker in text', () => {
    expect(fixtureLeak(`Sample profile ${FIXTURE_MARKER} for tests`)).toBe(true);
    expect(fixtureLeak('Real intro text.')).toBe(false);
  });
});

describe('buildFlagError', () => {
  it('allows the normal combinations', () => {
    expect(buildFlagError({})).toBeUndefined();
    expect(buildFlagError({ PUBLIC_INDEXABLE: 'true', PUBLIC_INCLUDE_DRAFTS: 'false' })).toBeUndefined();
    expect(buildFlagError({ PUBLIC_CONTENT_FIXTURES: 'true', PUBLIC_INDEXABLE: 'false' })).toBeUndefined();
    expect(buildFlagError({ PUBLIC_CONTENT_FIXTURES: 'false', PUBLIC_INDEXABLE: 'true' })).toBeUndefined();
  });
  it('refuses fixtures on an indexable build', () => {
    expect(buildFlagError({ PUBLIC_CONTENT_FIXTURES: 'true', PUBLIC_INDEXABLE: 'true' })).toMatch(
      /PUBLIC_CONTENT_FIXTURES=true with PUBLIC_INDEXABLE=true/,
    );
  });
  it('still refuses drafts on an indexable build', () => {
    expect(buildFlagError({ PUBLIC_INCLUDE_DRAFTS: 'true', PUBLIC_INDEXABLE: 'true' })).toMatch(/DRAFTS/);
  });
});

describe('distLeaks', () => {
  it('lists build outputs that carry the marker', () => {
    expect(
      distLeaks([
        { path: 'dist/index.html', text: 'hello' },
        { path: 'dist/about.html', text: `Sample ${FIXTURE_MARKER}` },
      ]),
    ).toEqual(['dist/about.html']);
    expect(distLeaks([])).toEqual([]);
  });
});

describe('fixtureFileName', () => {
  it('flags fixture-style names only', () => {
    expect(fixtureFileName('sample-sdk.json')).toBe(true);
    expect(fixtureFileName('example-resume.pdf')).toBe(true);
    expect(fixtureFileName('adtech-ios-sdk.json')).toBe(false);
    expect(fixtureFileName('resume-sample.pdf')).toBe(false);
  });
});
