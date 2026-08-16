# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Project

Spiccioli is an Electron + React desktop ledger for macOS, Windows and Linux: one person's accounts, transactions, investments and salaries, kept in one file they choose. Standalone browser mode is not a supported runtime.

Only the scaffolding exists so far. `src/components/common/PlaceholderPage.tsx` is a placeholder that goes away with the launch screen of [§12.1](docs/functional/specs/12-storage.md).

## Documentation

There are two documentation sets and they answer different questions.

- **`docs/functional/`** is the specification: what Spiccioli does, screen by screen, with the reasoning behind every decision in its `why/` files.
- **`docs/technical/`** is the implementation reference: architecture, repository map, how to build and run, the framework layer, the conventions that only make sense next to the code, and the implementation plan of [§8](docs/technical/08-implementation-plan.md) — the decisions still open and the phases from here to v1.

This file holds only the rules and the commands; the reasoning behind them lives in those two places.

When you need either set, start from its `README.md` and then read ONLY the sections relevant to the current task. Always read the relevant `docs/technical/` section before changing an area you have not touched yet in this session.

The code MUST always adhere to `docs/functional/specs`. If a defect in a specification, or a reason to change one, comes up during development, raise it and stop there: the specification is amended only after the user has approved the change. In contrast, `docs/functional/mockups` are guidelines rather than hard specs and can be adapted when the need arises. `docs/functional/why` is read only to recover the original rationale when a change to a specification is being weighed.

## Commands

```sh
npm run lint           # ESLint flat config (eslint.config.js)
npm run typecheck      # tsc --noEmit
npm test               # Vitest, tests/ only
npm start              # hot-reloading loop: Vite dev server for the renderer, watched Electron bundles that relaunch the app
npm run start-packaged # build React + Electron bundles once, then electron-forge start
npm run build          # build-react + build-electron
npm run build-icons    # regenerate assets/icon.{icns,ico,png} from assets/icon.svg
```

Prefer running a single test file while iterating:

```sh
npm test -- tests/main/SomeFile.test.ts
```

## Hard Rules

- Work only in this repository and only on the current branch.
- Do NOT edit `docs/functional/` unless the change was discussed and approved first.
- Do NOT edit `TODO.md`.
- `README.md` is the landing page a user reads: what Spiccioli is and how to install it, and nothing else. Every technical detail belongs in `docs/technical/`, which it links to.
- Keep `CLAUDE.md` and `docs/technical/` aligned and up to date. If either becomes stale or contradicts the project state, fix it as part of the task.
- Do NOT introduce extra libraries unless you justify them briefly and they clearly reduce work or risk.
- `package.json` dependencies must use exact versions. No `^` or `~`.
- Build and test tooling may own the build: Vite bundles the renderer and Vitest runs the tests. Do NOT add an application framework such as Next.js, Remix or Astro: nothing may own routing, rendering or the component model. The application code stays plain React + TypeScript + CSS.
- Leave ignored files and `.gitignore` patterns alone.
- The ledger file format is not decided yet ([§12](docs/functional/specs/12-storage.md)). Deciding it is a design step of its own, and it is what a persistence dependency would follow from, so do not add one before it. Electron's bundled `node:sqlite` needs no dependency at all and is the option to beat.
- A packaged run always loads the renderer from the built `build/index.html` on disk. The development server URL is read from the environment, so it must never be honoured when `app.isPackaged`: anything able to set an environment variable would otherwise put a page of its own choosing behind the preload bridge. The strict Content-Security-Policy in `index.html` is relaxed for the development server's page only, never for the built one.
- `src/framework` is reusable scaffolding meant to be lifted into another application as it is. It must NEVER import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, or `src/config`. Anything it needs about Spiccioli is passed in through its options. ESLint enforces this.
- Nothing leaves the machine except the security identifiers sent to a price provider when the user presses *Update prices* ([§7.6](docs/functional/specs/07-investments.md)). No telemetry, no crash reporting service, no update check.
- Log files must NEVER contain sensitive data such as amounts or transaction descriptions. Redact it before it is written.
- Derived data is never stored ([§1](docs/functional/specs/01-premise-and-constraints.md)). Balances, holdings, averages, totals and pairings are recomputed every time they are shown. The category a rule assigns to a transaction is the one deliberate exception, and it stays the only one.
- Failures that reach the top of the main process must leave a trace and, once the language is resolved, reach the user. A render error must not empty the window. Neither path may be removed without replacing it: a silent failure in a released build is unreportable.
- `productName` in `package.json` and `packagerConfig.appBundleId` in `forge.config.js` name the folder the preferences and the recent-file list live in, and macOS keeps permissions and window state under the bundle identifier. The makers must keep naming the same executable.
- A release is a `v<version>` tag, and `.github/workflows/release.yml` is what builds its installers. The installers of the three platforms cannot be built on one machine, so nothing may assume a local `npm run make` produces a whole release. The `version` field of `package.json` is what the installers and the About item carry, so it is raised in the commit the tag is put on.

## Code Conventions

- Use absolute imports rooted at `src/...` for in-repository React sources and assets, including CSS. Never relative `./` or `../`.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files.
- Prefer existing project patterns over new abstractions, but do centralize behavior into shared components/utilities when convenient.
- Tunable constants (sizes, delays, retry policies, file and directory names) belong in `src/config/AppConfig.ts`, not inline in modules.
- Anything the user can click is a real control and not a clickable `div`, so the keyboard reaches it and activates it. Every focusable control shows the one focus ring `src/index.css` applies to `:focus-visible`, and never a focus style of its own: a control that has to draw its own must override that rule and say why. Give the ring room where something would clip it instead of dropping it.
- Every string the user can read belongs in the translation bundle at `src/i18n/lang/en.ts`, never inline in a component. Components reach it through `useTranslator()`; pure logic and the Electron main process take a translator, or just the labels they need, as a parameter. Developer-facing strings (log messages, `console` output, errors only a bug can raise) stay in the module that owns them and stay in English.
- Use a plural translation entry rather than comparing a count against 1, and interpolate values through `{name}` placeholders rather than string concatenation, so number formatting and plural rules follow the language.
- Spiccioli ships English only and offers no language selector ([§1](docs/functional/specs/01-premise-and-constraints.md)). The translation layer is what keeps a second language from being a rewrite, so it stays even though it resolves to one bundle today.
- Dates and decimal separators come from the preferences of [§10](docs/functional/specs/10-settings.md), never from a system locale.
- Every amount is EUR and is printed with `€`. There is no currency field, no currency preference and no conversion ([§1](docs/functional/specs/01-premise-and-constraints.md)).
- One dark theme, no light theme and no theme switch. Colors come from the variables in `src/index.css` and are never written inline.
- `src/framework` takes Spiccioli's configuration values and its user-facing wording as parameters instead of reading `AppConfig` or owning text, the way `DateUtils` takes its date labels and `BackupDirectory` takes its refusal messages. It holds no module-level state, so everything is created by a factory; the process-wide `appLogger` and the pure `Intl` memoization caches are the only exceptions. Put new code there only when it would be just as useful to a different application, and in Spiccioli otherwise: moving it later is easy, untangling it is not.
- Match the existing code style exactly, including spacing and newline conventions. Read a neighboring file before writing a new one.

## Testing

Testing stays minimal but meaningful: focused unit tests for important logic plus 1-2 smoke tests for critical user flows. New logic in `src/logic`, `src/main` and `src/framework` should come with unit tests.

Tests for `src/framework` live in `tests/framework` and must depend only on framework modules, so they travel with the folder. Spiccioli tests live in `tests/main`, `tests/logic`, and `tests/components`.

All three checks must pass before a feature or fix is considered done:

```sh
npm run lint && npm run typecheck && npm test
```

## Workflow

1. For a non-trivial change, read the `docs/functional/` section it implements, then the relevant `docs/technical/` section.
2. Implement, following the conventions above.
3. Run lint, typecheck, and tests. Fix what breaks.
4. Update `docs/technical/` if behavior, architecture, or repository structure changed.
5. Commit, with an imperative summary as the first line, e.g. `Drain storage commands on shutdown`.

Commit when a task is complete. Do not amend or rewrite existing commits, and do not push unless asked.
