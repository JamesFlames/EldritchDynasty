/** Reading choices belong to the reader, not to a saved world. */
export type TextScale = 'standard' | 'large' | 'largest';
export type ReadingFont = 'book' | 'readable';

export interface AccessibilityPreferences {
  textScale: TextScale;
  readingFont: ReadingFont;
}

export const ACCESSIBILITY_STORAGE_KEY = 'eldritch-dynasty:reading';

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textScale: 'standard',
  readingFont: 'book',
};

function isTextScale(value: unknown): value is TextScale {
  return value === 'standard' || value === 'large' || value === 'largest';
}

function isReadingFont(value: unknown): value is ReadingFont {
  return value === 'book' || value === 'readable';
}

/** A bad or older preference must never stop the title screen from opening. */
export function loadAccessibility(storage: Pick<Storage, 'getItem'> | null): AccessibilityPreferences {
  if (!storage) return { ...DEFAULT_ACCESSIBILITY };
  try {
    const parsed = JSON.parse(storage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? 'null') as {
      textScale?: unknown;
      readingFont?: unknown;
    } | null;
    return {
      textScale: isTextScale(parsed?.textScale) ? parsed.textScale : DEFAULT_ACCESSIBILITY.textScale,
      readingFont: isReadingFont(parsed?.readingFont) ? parsed.readingFont : DEFAULT_ACCESSIBILITY.readingFont,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY };
  }
}

export function applyAccessibility(
  root: HTMLElement,
  preferences: AccessibilityPreferences,
): void {
  root.dataset.textScale = preferences.textScale;
  root.dataset.readingFont = preferences.readingFont;
  // A percentage preserves the browser/OS base size the reader already chose;
  // every client size is rem-based, so the whole existing ladder follows it.
  root.style.fontSize = preferences.textScale === 'largest'
    ? '130%'
    : preferences.textScale === 'large' ? '115%' : '';
}

export function saveAccessibility(
  storage: Pick<Storage, 'setItem'> | null,
  preferences: AccessibilityPreferences,
): void {
  if (!storage) return;
  try {
    storage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // A private or full store is not a reason to take the game away. The
    // preference still applies for this session through the document root.
  }
}
