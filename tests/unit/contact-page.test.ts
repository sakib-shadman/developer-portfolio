import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../src/lib/content/types';

const state = vi.hoisted(() => ({ profile: undefined as unknown }));
vi.mock('../../src/lib/content/queries', async () => {
  const { composeHomeSections } = await import('../../src/lib/home');
  return {
    getProfile: async () => state.profile,
    getSkillGroups: async () => [],
    getHomeSections: async () => composeHomeSections({ skillGroups: [], experience: [] }),
  };
});

import Contact from '../../src/pages/contact.astro';
import ContactDirect from '../../src/components/contact/ContactDirect.astro';

const base: Profile = {
  name: 'Ada Lovelace',
  title: 'Engineer',
  headline: 'h',
  intro: 'i',
  focus: [],
  links: {},
  stats: [],
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
async function render(profile: Profile): Promise<string> {
  state.profile = profile;
  const html = await c.renderToString(Contact, { request: new Request('http://localhost/contact') });
  return html.slice(html.indexOf('<main'), html.indexOf('</main>'));
}

describe('contact page: no email', () => {
  const profile: Profile = {
    ...base,
    availability: 'Open to roles.',
    location: 'Dhaka',
    timezone: 'GMT+6',
    links: { github: 'https://github.com/ada' },
  };
  it('shows links and availability and says nothing about email', async () => {
    const html = await render(profile);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('Open to roles.');
    expect(html).toMatch(/href="https:\/\/github\.com\/ada"[^>]*rel="noopener noreferrer"/);
    expect(html).toContain('Dhaka · GMT+6');
    expect(html).not.toMatch(/mailto:|Email me|Copy address|copy-status|>Email</);
    expect(html).not.toContain('Reply time');
    expect(html).not.toMatch(/<form/);
  });
  it('minimal profile: no empty lists or facts block', async () => {
    const html = await render(base);
    expect(html).not.toContain('<dl');
    expect(html).not.toContain('class="links');
    expect(html).toMatch(/<h1[^>]*>Let(&#39;|')s talk\.<\/h1>/);
  });
});

describe('contact page: email', () => {
  const profile: Profile = { ...base, email: 'ada@example.dev', replyTime: 'within 2 days' };
  it('renders mailto with subject, copy button and a live region', async () => {
    const html = await render(profile);
    expect(html).toMatch(/<a href="mailto:ada@example\.dev\?subject=Hello%20from%20your%20portfolio"/);
    expect(html).toMatch(/<button[^>]*data-copy="ada@example\.dev"[^>]*aria-describedby="copy-status"/);
    expect(html).toMatch(/<p id="copy-status" role="status"/);
    expect(html).toContain('ada@example.dev</span>');
    // Without JS the copy button would be dead: it ships hidden and the script reveals it.
    expect(html).toMatch(/<button[^>]*data-copy=[^>]*\bhidden\b/);
  });
  it('facts are a valid dl: dt/dd only inside each group, icon inside dt', async () => {
    const html = await render({ ...profile, location: 'Dhaka' });
    expect(html).toMatch(/<div class="fact[^"]*"[^>]*><dt[^>]*><svg[\s\S]*?<\/svg>\s*Location<\/dt><dd/);
    expect(html).not.toMatch(/<div class="fact[^"]*"[^>]*><svg/);
  });
  it('reply time only when provided', async () => {
    expect(await render(profile)).toMatch(/Reply time<\/dt>\s*<dd[^>]*>within 2 days/);
    expect(await render({ ...profile, replyTime: undefined })).not.toContain('Reply time');
  });
});

describe('ContactDirect form slot (PUBLIC_CONTACT_FORM)', () => {
  const html = (props: Record<string, unknown>, withSlot: boolean) =>
    c.renderToString(ContactDirect, {
      props,
      slots: withSlot ? { form: '<form id="f"></form>' } : {},
    });
  it('renders the slot only when enabled and provided', async () => {
    expect(await html({ email: 'a@b.dev', formEnabled: true }, true)).toContain('<form id="f">');
    expect(await html({ email: 'a@b.dev', formEnabled: false }, true)).not.toContain('<form');
    expect(await html({ email: 'a@b.dev', formEnabled: true }, false)).not.toContain('form-card');
  });
  it('renders nothing without an email or form', async () => {
    expect((await html({ formEnabled: false }, false)).trim()).not.toContain('Email me');
  });
});
