import { describe, expect, it } from 'vitest';
import {
  articleBodyHit,
  findPlaceholders,
  isPlaceholder,
  looseMdxContent,
  resumeError,
} from '../../src/lib/content/guards';

describe('placeholder guard', () => {
  it.each(['[Project name]', '[X]', 'Built with [Tech]', 'TODO: write bio', 'TBD', 'Lorem ipsum dolor'])(
    'flags %s',
    (v) => expect(isPlaceholder(v)).toBe(true),
  );

  it.each(['Flutter', 'Large-scale live scoring and statistics app for cricket.', 'Array<Int>'])(
    'accepts %s',
    (v) => expect(isPlaceholder(v)).toBe(false),
  );

  it('reports JSON paths', () => {
    const hits = findPlaceholders({ name: 'ok', items: ['fine', { role: '[Your role]' }], n: 3, x: null });
    expect(hits).toEqual([{ path: '$.items[1].role', value: '[Your role]' }]);
  });
});

describe('looseMdxContent', () => {
  const doc = (body: string) => `---\nproject: x\nproblem: y\n---\n${body}`;
  it('accepts content only inside Sections, plus imports, exports and comments', () => {
    const ok = doc(
      `import a from './a'\n\n{/* note */}\n\n<Section eyebrow="A" title="B">\n\ntext\n\n\`\`\`dart\n<Section>\n\`\`\`\n\n</Section>\n`,
    );
    expect(looseMdxContent(ok)).toEqual([]);
  });

  it('flags text, headings and components outside a Section with their file line numbers (frontmatter included)', () => {
    const bad = doc(
      `Loose paragraph\n\n<Section eyebrow="A" title="B">\nin\n</Section>\n\n## Heading\n<Callout>x</Callout>\n`,
    );
    expect(looseMdxContent(bad)).toEqual([
      { line: 5, text: 'Loose paragraph' },
      { line: 11, text: '## Heading' },
      { line: 12, text: '<Callout>x</Callout>' },
    ]);
  });

  it('handles multi-line Section tags and a single-line Section', () => {
    expect(
      looseMdxContent(
        '<Section\n  eyebrow="A"\n  title="B"\n>\nbody\n</Section>\n<Section eyebrow="C" title="D">x</Section>',
      ),
    ).toEqual([]);
  });

  it('a self-closing Section opens nothing, so content after it is still loose', () => {
    expect(looseMdxContent('<Section eyebrow="A" title="B" />\nloose\n')).toEqual([
      { line: 2, text: 'loose' },
    ]);
    expect(looseMdxContent('<Section\n  eyebrow="A"\n  title="B"\n/>\nloose\n')).toEqual([
      { line: 5, text: 'loose' },
    ]);
    expect(
      looseMdxContent('<Section eyebrow="A" title="B" />\n<Section eyebrow="C" title="D">\nok\n</Section>\n'),
    ).toEqual([]);
  });

  it('reports lines of a file without frontmatter from 1', () => {
    expect(looseMdxContent('loose')).toEqual([{ line: 1, text: 'loose' }]);
  });
});

describe('resumeError', () => {
  it('reports a configured resume that is missing from public/', () => {
    expect(resumeError('/resume/cv.pdf', () => false)).toBe(
      'src/content/profile.json $.main.resume: file public/resume/cv.pdf does not exist',
    );
  });
  it('rejects a path without a leading slash', () => {
    expect(resumeError('resume/cv.pdf', () => true)).toContain('must start with "/"');
  });
  it('is silent when there is no resume or the file exists', () => {
    expect(resumeError(undefined, () => false)).toBeUndefined();
    expect(resumeError('/resume/cv.pdf', (p) => p === 'public/resume/cv.pdf')).toBeUndefined();
  });
});

describe('articleBodyHit (ADR-0003)', () => {
  const fm = '---\ntitle: A\nurl: https://medium.com/x\n---\n';
  it('accepts frontmatter-only files, with or without trailing blank lines', () => {
    expect(articleBodyHit(fm)).toBeUndefined();
    expect(articleBodyHit(`${fm}\n\n  \n`)).toBeUndefined();
    expect(articleBodyHit('---\ntitle: A\n---')).toBeUndefined();
    expect(articleBodyHit(fm.replace(/\n/g, '\r\n'))).toBeUndefined();
  });
  it('reports the first non-blank body line with its file line number', () => {
    expect(articleBodyHit(`${fm}\n  Some prose here.\nmore`)).toEqual({ line: 6, text: 'Some prose here.' });
    expect(articleBodyHit(`${fm}# Heading`)).toEqual({ line: 5, text: '# Heading' });
  });
  it('treats a file without frontmatter as all body', () => {
    expect(articleBodyHit('hello')).toEqual({ line: 1, text: 'hello' });
  });
});
