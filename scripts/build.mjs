import { cp, mkdir, readdir } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles } from './public-files.mjs';

const destination = new URL('../dist/', import.meta.url);
await mkdir(destination, { recursive: true });
// Refuse stale output instead of silently publishing files from an earlier build.
const unexpected = [];
for (const entry of await readdir(destination, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = relative(fileURLToPath(destination), `${entry.parentPath}/${entry.name}`).replaceAll('\\', '/');
  if (!publicFiles.includes(file)) unexpected.push(file);
}
if (unexpected.length) throw new Error(`Unexpected files in dist: ${unexpected.join(', ')}. Use a clean checkout to build.`);
for (const file of publicFiles) {
  const target = new URL(file, destination);
  await mkdir(new URL('.', target), { recursive: true });
  await cp(new URL(`../${file}`, import.meta.url), target);
}
console.log(`Prepared ${publicFiles.length} public files in dist/.`);
