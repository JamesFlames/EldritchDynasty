import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function userContentRoot(userData) {
  return join(userData, 'mods', 'content');
}

export function readUserContent(root) {
  const out = {};
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir).sort();
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (!stat.isFile() || !entry.endsWith('.yaml')) continue;
      out[relative(root, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(root);
  return out;
}
