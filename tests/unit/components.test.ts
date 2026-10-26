import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Breadcrumbs from '../../src/components/layout/Breadcrumbs.astro';
import Footer from '../../src/components/layout/Footer.astro';
import Header from '../../src/components/layout/Header.astro';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('Header', () => {
  it('marks the current section with aria-current and hides Resume when not configured', async () => {
    const html = await container.renderToString(Header, {
      props: { name: 'Shadman Sakib' },
      request: new Request('http://localhost/projects/lms-cricket'),
    });
    expect(html).toMatch(/<a href="\/projects"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).not.toContain('Resume');
    expect(html).toContain('aria-label="Primary"');
  });

  it('shows Resume when a resume path is configured', async () => {
    const html = await container.renderToString(Header, {
      props: { name: 'Shadman Sakib', resume: '/resume/cv.pdf' },
      request: new Request('http://localhost/'),
    });
    expect(html).toMatch(
      /<a href="\/resume\/cv\.pdf" class="resume[^"]*"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>\s*Resume/,
    );
    expect(html).toMatch(/Resume\s*<span class="sr-only"[^>]*> \(opens in a new tab\)<\/span>/);
    expect(html).not.toContain('aria-current');
  });

  it('drops an unsafe resume href instead of rendering a link', async () => {
    const html = await container.renderToString(Header, {
      props: { name: 'Shadman Sakib', resume: 'javascript:alert(1)' },
      request: new Request('http://localhost/'),
    });
    expect(html).not.toContain('Resume');
    expect(html).not.toContain('javascript:');
  });
});

describe('Footer', () => {
  it('omits Resume/RSS when absent, always has Back to top', async () => {
    const html = await container.renderToString(Footer, { props: { name: 'Shadman Sakib' } });
    expect(html).not.toContain('Resume');
    expect(html).not.toContain('rss.xml');
    expect(html).toContain('href="#top"');
    expect(html).not.toContain(' · ');
  });

  it('renders location, resume and rss when provided', async () => {
    const html = await container.renderToString(Footer, {
      props: { name: 'S', location: 'Dhaka, Bangladesh', resume: '/resume/cv.pdf', rss: true },
    });
    expect(html).toContain('S · Dhaka, Bangladesh');
    expect(html).toMatch(
      /<a[^>]*class="pill[^"]*"[^>]*href="\/resume\/cv\.pdf"|<a[^>]*href="\/resume\/cv\.pdf"[^>]*class="pill/,
    );
    expect(html).toMatch(/href="\/resume\/cv\.pdf"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(html).toMatch(/Resume\s*<span class="sr-only"[^>]*> \(opens in a new tab\)<\/span>/);
    expect(html).toContain('href="/rss.xml"');
  });
});

describe('Breadcrumbs', () => {
  it('links ancestors and marks the last item as current', async () => {
    const html = await container.renderToString(Breadcrumbs, {
      props: {
        items: [
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: 'LMS Cricket' },
        ],
      },
    });
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toMatch(/<a href="\/projects"[^>]*>Projects<\/a>/);
    expect(html).toMatch(/aria-current="page"[^>]*>LMS Cricket/);
    expect(html.match(/aria-hidden="true"[^>]*>\s*\/\s*</g)).toHaveLength(2);
  });
});
