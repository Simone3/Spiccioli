# §2 — Repository map

*[Index](README.md) · [← §1 Architecture](01-architecture.md)*

Every non-generated file in the repository and what it is for. Generated folders — `node_modules/`, `build/`, `dist/`, `out/` — are ignored and not listed.

---

## 2.1 Root

| File | Purpose |
| --- | --- |
| `package.json` | Scripts, exact dependency versions, and the `productName` and `version` the packaged application carries |
| `tsconfig.json` | Strict TypeScript, `baseUrl: "."`, covering `src` and `tests` — which is what makes `src/...` imports resolve |
| `eslint.config.js` | The flat ESLint config: style, TypeScript, import, React, JSDoc and Vitest rules, plus the rule that keeps `src/framework` from importing application code |
| `vite.config.mts` | The renderer bundle and the Vitest configuration, in one file |
| `forge.config.js` | Electron Forge: the application identity, the four makers, and the fuses applied at package time |
| `index.html` | The renderer's HTML shell and the strict Content-Security-Policy the built page ships with |
| `CLAUDE.md` | The rules and commands for Claude Code |
| `README.md` | The landing page a user reads |
| `LICENSE` | Apache License 2.0 |
| `.gitignore` | Standard Node and build ignores, plus `.claude/settings.local.json` |

## 2.2 `src/main` — the Electron main process

| File | Purpose |
| --- | --- |
| `Main.ts` | The entry point: crash handlers, language, load target, logger, IPC handlers, window |
| `config/SpiccioliRuntimePaths.ts` | Where the preferences, the recent-file list and the log live ([§1.6](01-architecture.md#16-where-the-installations-own-files-live)) |
| `ipc/AppInfoIpc.ts` | Answers what version and platform the running build is |
| `preload/Preload.ts` | The context bridge: what the renderer is allowed to call |
| `window/WindowLoadTarget.ts` | Whether the window loads the built file or the development server, and the refusal of the latter in a packaged run |

## 2.3 `src/framework` — the reusable layer

Twenty-seven files that know nothing about Spiccioli. Listed and explained in [§4](04-framework.md), which also says which of them Spiccioli uses today.

## 2.4 `src` — the renderer and the shared code

| File | Purpose |
| --- | --- |
| `index.tsx` | Mounts React and the three providers above the screen |
| `index.css` | The theme variables, the body, and the one focus ring ([§6](06-styling.md)) |
| `vite-env.d.ts` | Declares what the preload bridge puts on `window` |
| `config/AppConfig.ts` | Every tunable constant, shared by both processes — so it must stay free of Node and Electron imports |
| `components/common/AppErrorBoundary.tsx` `.css` | The crash screen the renderer draws over itself |
| `components/common/PlaceholderPage.tsx` `.css` | The one screen there is so far. It goes away with the launch screen of [§12.1](../functional/specs/12-storage.md#121-the-launch-screen) |
| `i18n/Translations.ts` | Turns a language into a translator; the bundle registry |
| `i18n/TranslationContext.tsx` | The React binding of that translator |
| `i18n/lang/en.ts` | Every word the user can read |
| `types/AppInfoTypes.ts` `AppInfoIpcChannels.ts` | The shape and the channel names of the app-info request |
| `types/ElectronSquirrelStartup.d.ts` | Types for a dependency that ships none |

## 2.5 `tests`

| Path | Purpose |
| --- | --- |
| `setupTests.ts` | Runs before every test file: the Testing Library timer shim and a deterministic `crypto.randomUUID` |
| `vitest-env.d.ts` | Declares the Vitest globals the config enables |
| `framework/` | The framework's own tests, which depend only on framework modules |
| `main/` | Tests for the Electron main process modules |
| `components/` | Tests that render React components |
| `testUtils/` | Shared factories, re-exported through `testUtils/index.ts` |

Covered in [§7](07-testing.md).

## 2.6 `scripts`

| File | Purpose |
| --- | --- |
| `electron-bundle.js` | The one description of how the main and preload sources are bundled, shared by the two scripts below so a development run never runs a different bundle than the built one |
| `build-electron.js` | The one-shot esbuild build |
| `dev.js` | The development loop: Vite dev server, watched esbuild, and an Electron process relaunched on every rebuild |
| `build-icons.js` | Rasterizes `assets/icon.svg` into the three icon formats the packagers want |

## 2.7 Everything else

| Path | Purpose |
| --- | --- |
| `assets/icon.svg` | The master artwork every icon is generated from |
| `docs/functional/` | The functional analysis: the specification and its reasoning |
| `docs/technical/` | These pages |
| `.github/workflows/release.yml` | Builds the installers of a release on the three operating systems |
| `.vscode/` | The ESLint and TypeScript settings, and the launch configuration that attaches a debugger to both processes |
| `.claude/settings.json` | Which tools Claude Code may run without asking |
| `.claude/commands/` | `check` runs the three checks and fixes what fails; `sync-docs` reconciles these pages with the code |

---

[← §1 Architecture](01-architecture.md) · [§3 Build and run →](03-build-and-run.md)
