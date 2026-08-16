# §3 — Build and run

*[Index](README.md) · [← §2 Repository map](02-repository-map.md)*

---

## 3.1 Requirements

Node 24 or later, which is the version Electron bundles and what `engines.node` in `package.json` asks for. Then:

```sh
npm install
```

## 3.2 The commands

```sh
npm run lint           # ESLint flat config
npm run typecheck      # tsc --noEmit
npm test               # Vitest, tests/ only
npm start              # the development loop
npm run start-packaged # build both bundles once, then electron-forge start
npm run build          # build-react + build-electron
npm run build-icons    # regenerate assets/icon.{icns,ico,png} from assets/icon.svg
npm run make           # build the installers for the current platform
```

`npm run lint && npm run typecheck && npm test` is what has to pass before a change is done.

## 3.3 Two bundles, two bundlers

The renderer and the Electron sources are different targets, so they are built by different tools.

| | Renderer | Main and preload |
| --- | --- | --- |
| Tool | Vite | esbuild |
| Entry | `index.html` → `src/index.tsx` | `src/main/Main.ts`, `src/main/preload/Preload.ts` |
| Output | `build/` | `dist/electron/` |
| Target | `chrome150` — the renderer only ever runs in the Chromium Electron bundles, so nothing is downlevelled for other browsers | `node20`, CommonJS |
| Config | `vite.config.mts` | `scripts/electron-bundle.js` |

`electron` and `electron-log` are external to the esbuild bundle: they are resolved at runtime rather than bundled in.

Both configs resolve the `src/...` import prefix — Vite through an alias, esbuild through `tsconfig.json`. That is why an in-repository import is always absolute and never relative.

## 3.4 The development loop

`npm start` runs `scripts/dev.js`, which:

1. Starts a Vite development server for the renderer and reads back the URL it picked.
2. Starts a watching esbuild over the main and preload sources.
3. Spawns Electron with `SPICCIOLI_DEVELOPMENT_SERVER_URL` set to that URL, so the main process loads the renderer from the server instead of from disk.
4. Relaunches Electron on every successful rebuild of the Electron bundles. A build that failed leaves the running process alone: relaunching into a bundle that does not exist would only replace the error with a second one.

Editing a React source hot-reloads it in place. Editing `src/main` or `src/config` rebuilds and relaunches the window.

**The port is not fixed**, because the server picks it, which is why it is passed through the environment rather than written down anywhere.

`npm run start-packaged` is the other half of the picture: it builds both bundles once and starts the application the way a packaged one starts, loading `build/index.html` from disk. Use it to check anything that behaves differently when the renderer is not served.

## 3.5 The Content-Security-Policy, and why there are two

`index.html` ships a strict policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`. That is the policy the built page carries and the one a packaged run always uses.

The development server needs more than that — React Fast Refresh installs its runtime through an inline module script, and the hot update channel is a WebSocket back to the server — so `vite.config.mts` rewrites the meta tag **for the served page only**, through a plugin that applies on `serve` and never on `build`.

The plugin throws if it finds no policy to rewrite. The two policies live in different files, and nothing else would notice them drifting apart: failing loudly beats quietly serving a page the browser will block.

## 3.6 Packaging

`forge.config.js` describes the packaged application.

- **`asar: true`**, and the fuses plugin turns off `RunAsNode`, the `NODE_OPTIONS` variable and the CLI inspect arguments, turns on cookie encryption and ASAR integrity validation, and requires the app to load from the ASAR archive.
- **The identity** is `productName: "Spiccioli"` in `package.json` and `appBundleId: "io.github.simone3.spiccioli"` here. The bundle identifier cannot be changed lightly once the application is installed anywhere: macOS keeps permissions, window state and launch services entries under it, and a new one reads as a different application. The category is `public.app-category.finance`.
- **`assets/`, `.vscode/`, `coverage/`, `out/` and `tests/` are excluded** from the package. The icons are read from the repository at package time and do not need to be copied inside.
- **Four makers**: Squirrel for Windows, ZIP for macOS, and deb and rpm for Linux. The Linux package names are lowercase by convention while the binary inside keeps the `productName` spelling.

## 3.7 Icons

`npm run build-icons` runs `scripts/build-icons.js` inside Electron and regenerates `icon.icns`, `icon.ico` and `icon.png` from `assets/icon.svg`.

It renders two tiles in one offscreen capture: a full-bleed one for Windows and Linux, which scale and mask the artwork themselves, and an inset one for macOS, which renders the artwork exactly as it is and therefore follows Apple's grid — an 824×824 body centered on a 1024×1024 canvas. The `.icns` step needs macOS, because it shells out to `iconutil`; the other two formats are written on any platform.

## 3.8 Releasing

A release is a `v<version>` tag. Pushing it starts `.github/workflows/release.yml`, which builds the installers on macOS, Windows and Linux runners in parallel, runs lint, typecheck and tests on each, and collects the artifacts into a **draft** GitHub release. Nothing is published until the draft is published by hand.

Two consequences:

- **A local `npm run make` never produces a whole release.** The Squirrel installer needs Windows and the deb and rpm packages need a Linux distribution's packaging tools, so no one machine can build all three.
- **The version is raised in the commit the tag is put on**, because `package.json`'s `version` is what the installers and the About item carry.

The workflow can also be run by hand, which builds the installers and uploads them as workflow artifacts without creating a release. That is how it is tested without cutting a tag.

---

[← §2 Repository map](02-repository-map.md) · [§4 Framework layer →](04-framework.md)
