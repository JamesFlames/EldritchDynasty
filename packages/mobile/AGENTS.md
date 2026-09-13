# mobile — the Android shell

Capacitor wraps the already-built `@ed/client` application. This package owns
the Android activity, platform services, and store artefacts. It owns no game
rules, simulation state, content, or duplicate client UI.

## The seam

`src/platform-bridge.ts` is the Android implementation of the client's
`Platform` interface. It may use Capacitor plugins here; no file in
`packages/client/src` may name an Android or Capacitor API. The client receives
the generic `window.edPlatform` bridge before it starts.

Saves are opaque JSON. Preferences persists named snapshots, while core remains
the only authority that validates and resumes one. Do not add a second save
schema here.

## Commands

```bash
npm run sync --workspace @ed/mobile     # bundle the host bridge, copy client assets, sync plugins
npm run android                          # rebuild, sync, install/run the debug build on a selected device
```

`android/variables.gradle` pins min/compile/target SDK values explicitly. The
tag CI job creates `keystore.properties` from repository secrets; keys and that
file are ignored and must never be committed.

## Boundaries

- Keep all native dependencies and status/safe-area work here.
- `packages/client/dist` is generated. The bridge injection script may prepare
  it for `cap sync`; do not hand-edit it.
- The app must keep working offline. Do not add analytics, crash reporting, or
  a network dependency without revisiting the Play data-safety declaration.
