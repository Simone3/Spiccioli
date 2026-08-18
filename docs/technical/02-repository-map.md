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
| `Main.ts` | The entry point: crash handlers, language, load target, logger, configuration, the ledger session, IPC handlers, the menu, the window, and the bounded shutdown |
| `config/SpiccioliRuntimePaths.ts` | Where the preferences, the recent-file list and the log live ([§1.6](01-architecture.md#16-where-the-installations-own-files-live)) |
| `config/SpiccioliConfigStore.ts` | The preferences and the recent-file list, through the framework's configuration store |
| `config/StartupConfigurationLog.ts` | The one entry that describes the run the rest of the log belongs to |
| `ipc/AppInfoIpc.ts` | Answers what version and platform the running build is |
| `ipc/LedgerIpc.ts` | Everything the renderer asks of the file: the two dialogs, reading, creating, saving, the copies, the recent list, the preferences |
| `ipc/DiagnosticsIpc.ts` | The renderer's failures, written into the operational log with each text truncated |
| `ipc/PricesIpc.ts` | The one press that reaches the network, and the line the renderer sends back saying what the confirmation wrote |
| `menu/AppMenu.ts` | The File menu of four actions and the About item ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)), as a template a test can read |
| `prices/PriceProvider.ts` | What everything above the adapter sees: a listing in, and a quote or a reason out |
| `prices/YahooPriceProvider.ts` | **The one place that knows Yahoo** — the suffix table, the `v8/finance/chart` request, and the parse of the three fields a quote is made of |
| `prices/PriceQuoteReview.ts` | The four refusals of [§7.6](../functional/specs/07-investments.md#76-prices), applied to a quote before the user ever sees it |
| `prices/PricePass.ts` | One press, end to end: one paced request per security, each failing on its own, and the three log entries D14 fixes |
| `preload/Preload.ts` | The context bridge: what the renderer is allowed to call |
| `storage/LedgerSession.ts` | The one open ledger: which file, where its copies live, what its bytes hashed to, whether anything was written — and every storage entry in the log |
| `storage/LedgerBackupNaming.ts` | Where a ledger's copies live, what one is called, and how to recognise one |
| `window/WindowLoadTarget.ts` | Whether the window loads the built file or the development server, and the refusal of the latter in a packaged run |

## 2.3 `src/framework` — the reusable layer

Thirty files that know nothing about Spiccioli. Listed and explained in [§4](04-framework.md), which also says which of them Spiccioli uses today.

## 2.4 `src` — the renderer and the shared code

| File | Purpose |
| --- | --- |
| `index.tsx` | Mounts React and the providers above the screen |
| `index.css` | The theme variables, the body, and the one focus ring ([§6](06-styling.md)) |
| `vite-env.d.ts` | Declares what the preload bridge puts on `window` |
| `config/AppConfig.ts` | Every tunable constant, shared by both processes — so it must stay free of Node and Electron imports |
| `components/SpiccioliApp.tsx` | Which of the two states the application is in: no file, or one open |
| `components/common/AppErrorBoundary.tsx` `.css` | The crash screen the renderer draws over itself, and the report it sends to the log |
| `components/common/` | The kit every screen is made of, one `.tsx` and one `.css` per control: `AppButton` (and the link that looks like one), `DecimalField` with the `NumericFields` it is used as, `TextField`, `DateField`, `SelectField`, `DataTable`, `RowMenu`, `TabBar`, `FormDialog` with the `FormField` rows it holds, `ConfirmDialog`, `InlineEditCell` with the `EditableCell` that holds the value being typed into one, `FilterBar`, `EmptyState`, `Chip`, `LineChart` — **the only file that imports the charting library** |
| `components/shell/AppRoutes.ts` | The nine paths and the eight sidebar entries, written down once |
| `components/shell/AppShell.tsx` `.css` | The sidebar and the routed screen beside it, and the return to Portfolio when the open file changes |
| `components/shell/Sidebar.tsx` `.css` | The eight screens, the failing-check badge and the save state ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)) |
| `components/shell/ScreenLayout.tsx` `.css` | The shape every screen has, and the note a screen that is still a shell carries |
| `components/shell/StorageNotices.tsx` `.css` | The three lines the file can put on whichever screen the user is on |
| `components/shell/TransactionHandoff.ts` | How one screen hands its filters to Transactions, over the router's own location state ([§5.2](../functional/specs/05-transactions.md#52-ordering-and-paging)) |
| `components/launch/LaunchScreen.tsx` `.css` | The screen the application always opens with ([§12.1](../functional/specs/12-storage.md#121-the-launch-screen)) |
| `components/launch/UpgradeDialog.tsx` | Its second panel: a file written by an older version |
| `components/session/WriteFailurePanel.tsx` `.css` | The blocking message after five failed attempts, which belongs to no screen |
| `components/session/UnsavedDraftPrompt.tsx` | The other thing that belongs to no screen: what is said when something unwritten is being walked away from, offering discard and stay and no apply |
| `components/settings/SettingsScreen.tsx` `.css` | The ten preferences, the refusals, and the two read-only paths ([§10](../functional/specs/10-settings.md)) |
| `components/accounts/` | The Accounts screen ([§4](../functional/specs/04-accounts.md)): the two tabs and their tables, the two forms, and `AccountPicker` — **the one account picker in the application**, which every later screen takes for a transaction's, a trade's or a filter's |
| `components/transactions/` | The Transactions screen ([§5](../functional/specs/05-transactions.md)): the list with every cell edited in place, the seven filters, the pager, and the add form |
| `components/import/` | Bulk import ([§5.7](../functional/specs/05-transactions.md#57-bulk-import)): the paste, the three format controls, the account, the outcome, and the preview table that marks every row |
| `components/categories/` | The Categories screen ([§6](../functional/specs/06-categories.md)): the three tabs, the categories × years matrix, the rule list with its drag reorder and its draft session, the rule form and the consequence summary — and `CategoryPicker`, **the one category picker in the application**, which a transaction, a filter and a rule all take |
| `components/investments/` | The Investments screen ([§7](../functional/specs/07-investments.md)): the four tabs, the derived holdings with their inline price editor and their detail panel, the two trade tables with their filters and their forms, the securities list with its price history, the *Update prices* button with the statement of what leaves the machine and the review panel a pass ends in — and `SecurityPicker`, **the one security picker in the application**, plus the `SecurityFields` both forms that create one are built from |
| `components/salaries/` | The Salaries screen ([§8](../functional/specs/08-salaries.md)): the two tabs, the contract selector that scopes the first of them, the contracts table and its form, the per-year table whose working-days cell **is** the ContractYear record, the twelve-column payslip table and its form, and the two charts |
| `components/portfolio/` `checks/` | One folder per screen. Each holds its shell and its empty state until the phase that builds it |
| `contexts/LedgerContext.tsx` | The ledger in memory, the autosave, the save state, the storage lines |
| `contexts/PreferencesContext.tsx` | The ten preferences, read once and written as they change, and the formatter they define |
| `contexts/UnsavedDraftContext.tsx` | The guard every departure goes through, and the draft a screen registers with it ([§1.3](01-architecture.md#13-layers-inside-the-renderer)) |
| `i18n/Translations.ts` | Turns a language into a translator; the bundle registry |
| `i18n/TranslationContext.tsx` | The React binding of that translator |
| `i18n/lang/en.ts` | Every word the user can read |
| `logic/accounts/Accounts.ts` | Everything pure about accounts and institutions: the two orderings, *Institution · Account*, the two counts, the uniqueness rules and what an account picker offers |
| `logic/categories/Categories.ts` | The two category orderings — alphabetical, which every picker, filter and list reads, and the stored `order`, which only the report does — the index a chip reaches a name through, and the live count the list tab shows |
| `logic/categories/Categorisation.ts` | The rule engine: what a rule compares, which rule claims a description, the pass that keeps an `automatic` category the one the rules produce, what each rule accounts for, and the four figures applying a list would produce |
| `logic/categories/RuleDraft.ts` | The draft the rule list is edited as, and what tells it apart from the list the file holds |
| `logic/categories/CategoryReport.ts` | The categories × years matrix: the columns, the four groups, the three subtotals and Net |
| `logic/investments/Holdings.ts` | The weighted-average-cost walk in its one order, the realised gain a sale leaves, the holdings that survive it, and what each one would leave you with if it were sold today |
| `logic/investments/AnnualisedReturn.ts` | The money-weighted return: the flows a position produces, the bisection that solves them, and every case that has no figure |
| `logic/investments/Trades.ts` | Everything pure about the two trade tables: the one ordering, the three filters, the derived total and what the footers sum |
| `logic/investments/Securities.ts` | The ticker ordering, what points at a security, what makes an ISIN a duplicate, and the price history — which day a record lands on and when one has gone stale |
| `logic/investments/PriceUpdate.ts` | Everything pure about a price pass: the listings that go out, what came back read against the file, and the records confirming it would write |
| `logic/salaries/Contracts.ts` | Everything pure about a contract: the ordering, the years it covers, what falls inside its life, and what a narrowing or a deletion would run into |
| `logic/salaries/Payslips.ts` | Which contract and which year a payslip belongs to, the order the table shows it in, and `netSalary` — the one derived field on the record |
| `logic/salaries/SalaryFigures.ts` | The salary figures of [§11.7](../functional/specs/11-calculations.md#117-salary-figures): one row per year, the years that read 0, the hourly rates that read *undefined*, and what the payslip table's footer sums |
| `logic/transactions/Transactions.ts` | Everything pure about the list: the one ordering, the seven filters, the footer total, the pages, and what a duplicate carries over |
| `logic/transactions/TransactionImport.ts` | Everything pure about a paste: how a line becomes a row, what makes one unreadable, which rows the file already holds, and what the ticked ones are written as |
| `logic/format/DateFormat.ts` `NumberFormat.ts` | Printing a day and printing a figure, the way the preferences say |
| `logic/format/Formatter.ts` | Both of those, bound once to the preferences in force |
| `logic/format/FilePathDisplay.ts` | Reading a path apart for display |
| `logic/ledger/` | The document: its version, its seed, its reader, its writer, its refusals and its upgrade ([§9](09-file-format.md)) |
| `logic/money/Money.ts` | The scales, the one division rule and the roundings |
| `logic/preferences/Preferences.ts` | The defaults, the reading of whatever the configuration file holds, and the rule that the two separators must differ — which Settings and the import's own controls both apply |
| `logic/storage/AutosaveScheduler.ts` | The debounce, and the rule that two writes never overlap |
| `types/AppInfoTypes.ts` `AppInfoIpcChannels.ts` | The shape and the channel names of the app-info request |
| `types/LedgerTypes.ts` | The eleven stored entities and every closed set they take |
| `types/LedgerIpcTypes.ts` `LedgerIpcChannels.ts` | What crosses the bridge for storage, and the channel names |
| `types/PriceIpcTypes.ts` `PriceIpcChannels.ts` | What crosses the bridge for a price pass, and the channel names |
| `types/PreferencesTypes.ts` | The ten preferences and the recent-file list |
| `types/ElectronSquirrelStartup.d.ts` | Types for a dependency that ships none |

## 2.5 `tests`

| Path | Purpose |
| --- | --- |
| `setupTests.ts` | Runs before every test file: the Testing Library timer shim and a deterministic `crypto.randomUUID` |
| `vitest-env.d.ts` | Declares the Vitest globals the config enables |
| `framework/` | The framework's own tests, which depend only on framework modules |
| `main/` | Tests for the Electron main process modules |
| `logic/` | Tests for the pure logic: the money arithmetic, the reader, the writer, the upgrade, the autosave, the preferences, the calculations of each screen |
| `components/` | Tests that render React components |
| `testUtils/` | Shared factories, re-exported through `testUtils/index.ts`: the ledger records, the translator, and the application with its bridge stubbed and its providers in place |

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
