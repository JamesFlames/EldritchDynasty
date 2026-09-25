/**
 * PACKAGED MOD EDITOR ENTRYPOINT (#75 B2).
 *
 * The shell has one implementation. This tiny entrypoint selects its existing
 * Mod Editor mode before the shared main process creates a window. The dev
 * command selects the same mode with ED_MOD_EDITOR; packaging uses a different
 * main entry so an installed shortcut needs no command-line argument.
 */
process.env.ED_MOD_EDITOR = '1';
await import('./main.mjs');
