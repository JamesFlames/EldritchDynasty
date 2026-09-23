import docs from 'virtual:ed-content';
import { assembleBundle, type ContentBundle } from '@ed/schema';
import type { Platform } from '../platform.js';

/**
 * The shipped content is pre-parsed at build time (#109). The normal path
 * still does exactly one JSON assembly and never imports the YAML parser.
 * #75 deliberately makes user-authored desktop content the sole exception.
 */
let current: ContentBundle = assembleBundle(docs, JSON.parse);

/** Compose optional user files before Vue mounts. The host is read-only here. */
export async function installUserContent(platform: Platform): Promise<ContentBundle> {
  const files = await platform.readUserContent();
  if (Object.keys(files).length === 0) return current;

  // Vite emits this as a separate chunk. An unmodded game never fetches it.
  const [{ parse }, { bundleWithUserContent }] = await Promise.all([
    import('yaml'),
    import('@ed/schema'),
  ]);
  current = bundleWithUserContent(docs, files, parse);
  return current;
}

export function loadBundle(): ContentBundle {
  return current;
}
