# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Project

Spiccioli is an Electron + React desktop ledger for macOS, Windows and Linux: one person's accounts, transactions, investments and salaries, kept in one file they choose. Standalone browser mode is not a supported runtime.

**The application is feature complete and the implementation plan is spent**, so there is no phase to be in: a change from here is an ordinary change to a finished application, made against [`docs/functional/specs`](docs/functional/README.md) and the section of `docs/technical/` that covers the area. A file can be created, opened, saved, backed up, rotated, displaced by an external write and refused when unreadable; an open file lands on Portfolio, the sidebar reaches all eight screens, and **every one of the eight is finished**. The kit those screens are built from is `src/components/common/`, and the two files that import the charting library are `LineChart.tsx` and `PieChart.tsx` inside it; the one thing in the application that touches the network lives behind one interface in `src/main/prices/`; the fourteen checks and the five pairings of [§11.6](docs/functional/specs/11-calculations.md#116-derived-matching) are run in one place, `src/contexts/ChecksContext.tsx`, and everything pure about them is in `src/logic/checks/`.

**What is left before v1 is the release itself**: the `version` field of `package.json` raised in the commit the `v<version>` tag is put on, and `.github/workflows/release.yml` run by hand once before it.

## Documentation

There are two documentation sets and they answer different questions.

- **`docs/functional/`** is the specification: what Spiccioli does, screen by screen, with the reasoning behind every decision in its `why/` files.
- **`docs/technical/`** is the implementation reference: architecture, repository map, how to build and run, the framework layer, the conventions that only make sense next to the code, the ledger file format of [§9](docs/technical/09-file-format.md), and the fourteen decisions of [§8](docs/technical/08-decisions.md) — what the application is built to and may not quietly reopen, with the grounds behind each split into [`08-decisions-why.md`](docs/technical/08-decisions-why.md), which is read only when one is questioned.

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
- Keep `CLAUDE.md` and `docs/technical/` from going stale: fix either one when it contradicts the state of the project. `docs/technical/` is where a decision is recorded, and settling one does not earn a `CLAUDE.md` entry — add a rule here only when it would change what gets written *before* the relevant `docs/technical/` section would be read. Anything scoped to a single area belongs in that section alone.
- Do NOT introduce extra libraries unless you justify them briefly and they clearly reduce work or risk. The runtime set v1 adds is settled and is four, and **all four are now installed**: `react-router`, `react-datepicker` behind our own date control, dnd kit behind the rule list — taken as `@dnd-kit/core` with `@dnd-kit/sortable` — and `recharts` behind `src/components/common/LineChart.tsx` and `src/components/common/PieChart.tsx` ([§8.3](docs/technical/08-decisions.md#83-the-four-dependencies-v1-added)). Each one stays wrapped in components of ours, so nothing outside them imports it.
- `package.json` dependencies must use exact versions. No `^` or `~`.
- Build and test tooling may own the build: Vite bundles the renderer and Vitest runs the tests. Do NOT add an application framework such as Next.js, Remix or Astro — **React Router's own framework mode included**: no `@react-router/dev`, no route modules, no loaders or actions, no SSR. Nothing may own rendering, data loading or the component model; `react-router` is present as a library in declarative mode and nothing more ([§8.1](docs/technical/08-decisions.md#81-the-fourteen-decisions) D7). The application code stays plain React + TypeScript + CSS.
- Leave ignored files and `.gitignore` patterns alone.
- The ledger is **one JSON document** with the extension `.spiccioli`, read whole and written whole ([§8.1](docs/technical/08-decisions.md#81-the-fourteen-decisions)). The model lives in memory in the renderer, so the file is only ever parsed and serialized: it needs no persistence dependency and must not acquire one. Do not reach for a database, an ORM or a serialization library.
- **The file format is a contract, and [§9](docs/technical/09-file-format.md) is it.** Adding, removing or retyping a field of a stored entity is a shape change: it raises `schemaVersion`, registers an upgrade step in `src/logic/ledger/LedgerUpgrade.ts`, and updates [§9](docs/technical/09-file-format.md) and `scripts/write-sample-ledger.js` in the same commit — the script writes a file from §9 alone, and `tests/logic/FileFormat.test.ts` is what fails when the three drift apart. There is no such thing as a field the reader tolerates but the writer does not write — every key is present in every record, and a value that is not there is `null`.
- **The reader refuses; it never repairs.** An unknown key, a missing key, an unknown enum value, an unknown category, a non-integer figure, a malformed date, a duplicate key and a dangling reference are all refusals, stated to the user and written to the log. Nothing is ignored, nothing is rounded, nothing is defaulted, and there is no read-only mode. A refusal says everything it can about where it was raised — the entity, the record's own id, the position, the field, the name of the closed set — **and the value it found, which is shown to the user and never logged** ([§9.5](docs/technical/09-file-format.md#95-what-makes-a-file-not-understood)): what crosses to the main process is `redactLedgerRefusal` of it.
- Money, quantities and rates are **integers in minor units** ([§8.2](docs/technical/08-decisions.md#82-what-d3-fixes)): amounts in cents, quantities in millionths, unit prices and rates in ten-thousandths. A stored figure is never a fractional `number`, and conversion happens once at each boundary — the amount field, the import parser, the reader and the writer. **A division is the only inexact step**, and it rounds half away from zero. No `bigint` and no decimal library.
- Every save is **the whole file, atomically**, and the file's SHA-256 is re-checked before each one against what was recorded at the last read or write. A mismatch is an external modification and is handled as [§12](docs/functional/specs/12-storage.md) says: never ignored, and never resolved by asking the user to choose.
- A packaged run always loads the renderer from the built `build/index.html` on disk. The development server URL is read from the environment, so it must never be honoured when `app.isPackaged`: anything able to set an environment variable would otherwise put a page of its own choosing behind the preload bridge. The strict Content-Security-Policy in `index.html` is relaxed for the development server's page only, never for the built one.
- `src/framework` is reusable scaffolding meant to be lifted into another application as it is. It must NEVER import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, or `src/config`. Anything it needs about Spiccioli is passed in through its options. ESLint enforces this.
- Nothing leaves the machine except a security's `ticker` and `exchange`, and — when the user asks for a history rather than the latest quote — the day to start from, sent to the price provider when the user presses *Update prices* ([§7.6](docs/functional/specs/07-investments.md)). Not the ISIN, not an amount, not a quantity, not an account. No telemetry, no crash reporting service, no update check. The provider lives behind one adapter in the main process that nothing else imports, and **its ticker suffixes never reach the file** ([§8.1](docs/technical/08-decisions.md#81-the-fourteen-decisions) D11).
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
- **What a screen is showing is held in `useRemembered` (`src/contexts/ScreenMemoryContext.tsx`) rather than in `useState`** — its tab, its filters, the row selected — so it is found as it was left for as long as the file is open ([§12.2](docs/functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)). What a screen is *doing* stays ordinary state: an open form, a confirmation, an unwritten draft, a bulk selection. Adding a control a user sets means adding its field to `RememberedFields`.
- **Every hand-over between screens goes through `src/components/shell/ScreenHandoff.ts`**, which forgets the target screen's memory before it navigates — that is what makes a report cell, a finished import and a check entry a fresh arrival rather than filters added to filters. Nothing else may navigate with router location state.
- Anything the user can click is a real control and not a clickable `div`, so the keyboard reaches it and activates it. Every focusable control shows the one focus ring `src/index.css` applies to `:focus-visible`, and never a focus style of its own: a control that has to draw its own must override that rule and say why. Give the ring room where something would clip it instead of dropping it.
- Every string the user can read belongs in the translation bundle at `src/i18n/lang/en.ts`, never inline in a component. Components reach it through `useTranslator()`; pure logic and the Electron main process take a translator, or just the labels they need, as a parameter. Developer-facing strings (log messages, `console` output, errors only a bug can raise) stay in the module that owns them and stay in English.
- Use a plural translation entry rather than comparing a count against 1, and interpolate values through `{name}` placeholders rather than string concatenation, so number formatting and plural rules follow the language.
- Spiccioli ships English only and offers no language selector ([§1](docs/functional/specs/01-premise-and-constraints.md)). The translation layer is what keeps a second language from being a rewrite, so it stays even though it resolves to one bundle today.
- Dates and decimal separators come from the preferences of [§10](docs/functional/specs/10-settings.md), never from a system locale. **A number interpolated into a translated sentence follows them too**: the renderer's translator is built with the formatter, so `t('…', { count })` already writes the separators in force and nothing needs pre-formatting to get them ([§5.4](docs/technical/05-text-and-languages.md#54-placeholders-plurals-and-numbers)).
- Every amount is EUR and is printed with `€`. There is no currency field, no currency preference and no conversion ([§1](docs/functional/specs/01-premise-and-constraints.md)).
- One dark theme, no light theme and no theme switch. Colors come from the variables in `src/index.css` and are never written inline. A chart names a series by its number and a pie names a slice by its rank, never either by a colour, the five series variables and the eleven slice variables being fixed there too. **Type comes from the same file and is three families**: the sans everything is read in, the display face for a title and for the one figure a screen exists to state, and the mono for the small uppercase labels, for a figure in a column and for a path. A component names one of the three rather than a font stack of its own ([§6.2](docs/technical/06-styling.md#62-one-theme-and-it-is-dark)).
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
