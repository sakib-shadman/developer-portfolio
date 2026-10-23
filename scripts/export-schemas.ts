/** Writes the content contract as JSON Schema to docs/contract/ (ADR-0008). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { contract } from '../src/lib/content/schemas';

const out = new URL('../docs/contract/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, schema] of Object.entries(contract)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  writeFileSync(new URL(`${name}.schema.json`, out), JSON.stringify(json, null, 2) + '\n');
  console.log(`docs/contract/${name}.schema.json`);
}
