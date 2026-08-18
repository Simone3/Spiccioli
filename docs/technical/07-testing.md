# §7 — Testing

*[Index](README.md) · [← §6 Styling](06-styling.md)*

---

## 7.1 How much

Testing stays minimal but meaningful: focused unit tests for logic that is worth being sure about, plus one or two smoke tests for a critical user flow. Not a coverage target — a suite that stays fast enough to run on every change, and that fails for a reason.

New logic in `src/logic`, `src/main` and `src/framework` should come with unit tests.

## 7.2 Where they live

| Folder | Holds | May depend on |
| --- | --- | --- |
| `tests/framework/` | The framework's own tests | Framework modules only, so they travel with `src/framework` |
| `tests/main/` | Electron main process modules | Anything, with Electron's own API stubbed |
| `tests/logic/` | The pure logic of `src/logic` | Anything, and it needs nothing: none of it touches React, Electron or a filesystem |
| `tests/components/` | Rendered React components | Anything, with the preload bridge stubbed on `window` |
| `tests/testUtils/` | Shared factories, re-exported through `index.ts` | Anything |

**The framework rule is the strict one.** A test under `tests/framework` that imports a Spiccioli module has broken the property the folder exists for: the framework and its tests are meant to be copied into another application together.

A test imports application code through the absolute `src/...` prefix and its own siblings relatively — `import { renderWithTranslations } from '../testUtils'`.

## 7.3 The setup file

`tests/setupTests.ts` runs before every test file and does three things:

- Registers `@testing-library/jest-dom`, for the DOM matchers.
- **Exposes a minimal `jest` global.** Testing Library decides whether fake timers are installed by probing for one, and without it `findBy` queries poll on timers Vitest has already frozen — so those queries hang until the test times out. Only the single helper Testing Library calls is exposed; the suite itself uses `vi` everywhere.
- **Replaces `crypto.randomUUID` with a counter**, so identifiers are deterministic and a snapshot or an assertion can name one.

## 7.4 Conventions

- **Assert on English wording**, not on translation keys. The bundle is what defines the keys, so a key that stops existing has to fail somewhere, and this is where.
- **Render through the factories in `tests/testUtils`**, which supply what a component needs as a wrapper rather than wrapping the element — that way `rerender` keeps the providers in place. `renderWithTranslations` is the translator alone; `renderWithProviders` is every provider a screen needs; `renderApp` is the whole application; and `renderOpenLedger` opens a file through the launch screen, which is the only way into the shell.
- **A test's router is a memory one**, where the application installs a hash one. It is the single difference between the tree a test renders and the real one, and it is what lets a test start on a screen without a URL.
- **`stubLedgerBridge` stands in for the preload.** Every channel it publishes is answered, and a test overrides only the ones it cares about — so a channel added to the bridge is a compile error here rather than an undefined function at run time. It also puts the price bridge up, through `stubPricesBridge`, so that **no test can reach the network by forgetting to**: the default pass asks for nothing and comes back with nothing, and a test that wants a pass overrides it *after* opening the ledger.
- **Stub Electron at the seam.** The main process modules take the parts of Electron they use as options — `Pick<App, 'getPath' | 'isPackaged'>`, `Pick<IpcMain, 'handle'>` — so a test passes an object rather than mocking the `electron` module.
- **Test the refusal, not only the happy path.** The cases worth writing down are usually the ones that say no: a packaged run ignoring the development server variable, a bridge that does not answer.

## 7.5 Running them

```sh
npm test                                   # all of them
npm test -- tests/main/AppInfoIpc.test.ts  # one file, while iterating
```

Vitest is configured inside `vite.config.mts`, so the tests resolve `src/...` through the same alias the renderer build uses. The environment is `jsdom` and globals are enabled, which is why `describe`, `test`, `expect` and `vi` need no import — `tests/vitest-env.d.ts` is what tells TypeScript so.

---

[← §6 Styling](06-styling.md) · [§8 Implementation plan →](08-implementation-plan.md)
