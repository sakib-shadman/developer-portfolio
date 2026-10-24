// Type-level tests, checked by `pnpm typecheck` (astro check). Not executed.
import type { ComponentProps } from 'astro/types';
import type Button from '../../src/components/ui/Button.astro';

type P = ComponentProps<typeof Button>;

export const okLink: P = { href: '/x' };
export const okButton: P = { disabled: true, type: 'submit' };
export const okSolid: P = { variant: 'solid' };
// @ts-expect-error — links cannot be disabled
export const badLink: P = { href: '/x', disabled: true };
// @ts-expect-error — solid buttons are 52px (lg) only
export const badSolid: P = { variant: 'solid', size: 'md' };
