import { join } from 'node:path';

/**
 * THE ONE DESKTOP PROFILE (#75 B2).
 *
 * The game and the separately named Mod Editor must see the same saves,
 * library and `mods/content` directory. Electron's default userData path is
 * based on the application name, so two product names would otherwise create
 * two profiles and the editor would write pages the game never reads.
 *
 * Keep this name aligned with the shipped game's established profile. The game
 * already used this path before the Mod Editor package existed.
 */
export const DESKTOP_PROFILE = 'Eldritch Dynasty';

export function desktopUserData(appData) {
  return join(appData, DESKTOP_PROFILE);
}
