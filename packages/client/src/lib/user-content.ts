import {
  assembleBundle,
  validateBundle,
  type ContentBundle,
  type ContentSources,
  type Issue,
  type YamlParser,
} from '@ed/schema';

export class UserContentError extends Error {
  constructor(message: string, readonly issues: readonly Issue[] = []) {
    super(message);
    this.name = 'UserContentError';
  }
}

function locate(where: string, sources: ContentSources): string {
  const colon = where.indexOf(':');
  const id = (colon === -1 ? where : where.slice(colon + 1)).split('/')[0]!;
  const file = sources.get(id);
  return file ? `${file} → ${where}` : where;
}

function validationMessage(errors: readonly Issue[], sources: ContentSources): string {
  return errors
    .map((issue) => `ERROR  [${issue.rule}] ${locate(issue.where, sources)}: ${issue.message}`)
    .join('\n');
}

/**
 * Add user YAML to the precompiled document set, then run the same assembler
 * and validation rules as CI. V1 has no load order, patching or overrides.
 */
export function bundleWithUserContent(
  shippedDocs: Record<string, string>,
  userFiles: Record<string, string>,
  parseYaml: YamlParser,
): ContentBundle {
  const combined: Record<string, string> = { ...shippedDocs };

  for (const path of Object.keys(userFiles).sort()) {
    if (path in shippedDocs) {
      throw new UserContentError(
        `user content '${path}' shadows a shipped file; v1 supports new files and ids only`,
      );
    }
    try {
      combined[path] = JSON.stringify(parseYaml(userFiles[path]!) ?? null);
    } catch (error) {
      throw new UserContentError(`user content '${path}' could not be parsed: ${String(error)}`);
    }
  }

  const sources: ContentSources = new Map();
  let bundle: ContentBundle;
  try {
    bundle = assembleBundle(combined, JSON.parse, sources);
  } catch (error) {
    throw new UserContentError(`user content could not be assembled: ${String(error)}`);
  }

  const errors = validateBundle(bundle).filter((issue) => issue.level === 'error');
  if (errors.length) throw new UserContentError(validationMessage(errors, sources), errors);
  return bundle;
}
