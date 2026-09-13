import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const index = resolve(here, '../../client/dist/index.html');
const source = readFileSync(index, 'utf8');
const tag = '    <script src="./ed-platform.js"></script>\n';

if (!source.includes(tag)) {
  writeFileSync(index, source.replace('  </body>', `${tag}  </body>`), 'utf8');
}
