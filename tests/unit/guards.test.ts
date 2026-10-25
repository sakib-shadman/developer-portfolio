import { describe, expect, it } from 'vitest';
import { findPlaceholders, isPlaceholder, looseMdxContent } from '../../src/lib/content/guards';

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

  it('flags text, headings and components outside a Section with their body line numbers', () => {
    const bad = doc(
      `Loose paragraph\n\n<Section eyebrow="A" title="B">\nin\n</Section>\n\n## Heading\n<Callout>x</Callout>\n`,
    );
    expect(looseMdxContent(bad)).toEqual([
      { line: 1, text: 'Loose paragraph' },
      { line: 7, text: '## Heading' },
      { line: 8, text: '<Callout>x</Callout>' },
    ]);
  });

  it('handles multi-line Section tags and a single-line Section', () => {
    expect(
      looseMdxContent(
        '<Section\n  eyebrow="A"\n  title="B"\n>\nbody\n</Section>\n<Section eyebrow="C" title="D">x</Section>',
      ),
    ).toEqual([]);
  });
});
