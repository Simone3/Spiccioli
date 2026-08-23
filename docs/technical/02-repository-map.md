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
| `Main.ts` | The entry point: **the single-instance lock**, crash handlers, language, load target, logger, configuration, the ledger session, IPC handlers, the menu, the window, **the three ways a ledger arrives from outside**, and the bounded shutdown |
| `config/SpiccioliRuntimePaths.ts` | Where the preferences, the recent-file list and the log live ([§1.6](01-architecture.md#16-where-the-installations-own-files-live)) |
| `config/SpiccioliConfigStore.ts` | The preferences and the recent-file list, through the framework's configuration store |
| `config/StartupConfigurationLog.ts` | The one entry that describes the run the rest of the log belongs to |
| `ipc/AppInfoIpc.ts` | Answers what version and platform the running build is |
| `ipc/AppMenuIpc.ts` | What the menu bar Spiccioli draws itself says, and the closed set of commands that come back from it |
| `ipc/LedgerIpc.ts` | Everything the renderer asks of the file: the two dialogs, reading, creating, saving, the copies, the recent list, the preferences |
| `ipc/DiagnosticsIpc.ts` | The renderer's failures, written into the operational log with each text truncated |
| `ipc/PricesIpc.ts` | The one press that reaches the network, and the line the renderer sends back saying what the confirmation wrote |
| `menu/AppMenu.ts` | The File menu of four actions and the About item ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)), the Edit, View and Window menus the platform expects beside them, the three entries a development run adds — and the same menu again as the description the renderer draws on Windows |
| `menu/MenuCommands.ts` | What a drawn entry does, since it has no Electron role behind it: the closed set, and the refusal of a recent file the menu does not offer |
| `prices/PriceProvider.ts` | What everything above the adapter sees: a listing and a span in, and the days it carries or a reason out |
| `prices/YahooPriceProvider.ts` | **The one place that knows Yahoo** — the suffix table, the `v8/finance/chart` request in both its shapes, the parse of the live quote and of the daily bars, and **the `prices.http` entry** that writes the whole exchange with its elapsed milliseconds, this being the only place that has it |
| `prices/PriceQuoteReview.ts` | The four refusals of [§7.6](../functional/specs/07-investments.md#76-prices), applied before the user ever sees a figure — the currency to a whole response, the date and the value to each day of it |
| `prices/PricePass.ts` | One pass, end to end: one paced request per listing over the window it carries, each failing on its own, the answers it reports as it goes, the flag that abandons it, and the three log entries D14 fixes — the outcome of a listing, not the wire under it |
| `preload/Preload.ts` | The context bridge: what the renderer is allowed to call |
| `startup/FileOpenRequests.ts` | The ledger a launch asked for, held until the renderer takes it — and the rule that asking for the file already open only brings the window forward |
| `startup/LedgerFileArguments.ts` | The ledger a command line names, if it names one, on the launch that starts Spiccioli and on the one the lock refuses |
| `storage/LedgerSession.ts` | The one open ledger: which file, where its copies live, what its bytes hashed to, whether anything was written — and every storage entry in the log. **Every path that touches the file's bytes is serialized here**, so that two writes can never overlap |
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
| `components/common/` | The kit every screen is made of, one `.tsx` and one `.css` per control: `AppButton` (and the link that looks like one), `DecimalField` with the `NumericFields` it is used as, `TextField`, `DateField`, `SelectField`, `DataTable` — with the totals row a column opts into by carrying a `total`, so a total sits under the column it totals — `RowMenu`, `TabBar`, `FormDialog` with the `FormField` rows it holds and the `FormSection` heading that names a run of them, `ConfirmDialog`, `FilterBar`, `EmptyState`, `Chip`, `Pager` — the five controls a paginated table is walked with, which the transactions list and a price history share — `HintNote` — the note a figure carries, which is a real control so the keyboard reaches it — and `LineChart` with `PieChart`, **the only two files that import the charting library**, with `ChartAxisFormat` beside them for the one thing a chart's value axis writes that the charts themselves know nothing about |
| `components/shell/AppRoutes.ts` | The nine paths and the eight sidebar entries, written down once |
| `components/shell/AppShell.tsx` `.css` | The sidebar and the routed screen beside it, and the return to Portfolio — with every screen's memory emptied — when the open file changes |
| `components/shell/Sidebar.tsx` `.css` | The eight screens, the failing-check badge and the save state ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)) |
| `components/shell/ScreenLayout.tsx` `.css` | The shape every screen has — a heading, what the screen says about what it is showing, the controls beside it — and nothing of any screen's own |
| `components/shell/StorageNotices.tsx` `.css` | The three lines the file can put on whichever screen the user is on |
| `components/shell/TitleBar.tsx` `.css` | The row drawn where the window has no title bar of its own: the menu bar, and the open file's name |
| `components/shell/MenuBar.tsx` `.css` | That menu bar itself — the pointer, the keyboard, and the one submenu of a submenu the menu has |
| `components/shell/ScreenHandoff.ts` | Every hand-over there is, over the router's own location state: the filters one screen hands to Transactions, Investments or Salaries, and the follow of a check entry to the record it names ([§5.2](../functional/specs/05-transactions.md#52-ordering-and-paging), [§9](../functional/specs/09-checks.md)). **It is also the one place a screen is started over before it is arrived at** ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)) |
| `components/launch/LaunchScreen.tsx` `.css` | The screen the application always opens with ([§12.1](../functional/specs/12-storage.md#121-the-launch-screen)) |
| `components/launch/UpgradeDialog.tsx` | Its second panel: a file written by an older version |
| `components/session/WriteFailurePanel.tsx` `.css` | The blocking message after five failed attempts, which belongs to no screen |
| `components/session/UnsavedDraftPrompt.tsx` | The other thing that belongs to no screen: what is said when something unwritten is being walked away from, offering discard and stay and no apply |
| `components/session/UnwrittenChangesPrompt.tsx` `.css` | The third: what a close asks when the file never took the changes the session is ending with ([§12](../functional/specs/12-storage.md)) |
| `components/settings/SettingsScreen.tsx` `.css` | The thirteen preferences, the refusals, and the three read-only paths — the ledger's, its backups', and the log folder ([§10](../functional/specs/10-settings.md)) |
| `components/accounts/` | The Accounts screen ([§4](../functional/specs/04-accounts.md)): the two tabs and their tables, the two forms, and `AccountPicker` — **the one account picker in the application**, which every later screen takes for a transaction's, a trade's or a filter's |
| `components/transactions/` | The Transactions screen ([§5](../functional/specs/05-transactions.md)): the list, the seven filters, and the one form a row is both recorded on and corrected on |
| `components/import/` | Bulk import ([§5.7](../functional/specs/05-transactions.md#57-bulk-import)): the paste, the three format controls, the account, the outcome, and the preview table that marks every row |
| `components/categories/` | The Categories screen ([§6](../functional/specs/06-categories.md)): the three tabs, the categories × years matrix, the rule list with its drag reorder and its draft session, the rule form and the consequence summary — and `CategoryPicker`, **the one category picker in the application**, which a transaction, a filter and a rule all take |
| `components/investments/` | The Investments screen ([§7](../functional/specs/07-investments.md)): the four tabs, the read-only derived holdings with their detail panel, the two trade tables with their filters and the one form a trade is recorded and corrected on, and the securities list — which is **where every price is handled**: the history beside it — paged at twenty, newest first ([§7.4](../functional/specs/07-investments.md#74-securities)) — the form that records and corrects one, the *Update prices* button and the modal it opens — the page that chooses which securities and how far back, and the one that fills in as the pass runs and becomes its review. Plus `SecurityPicker`, **the one security picker in the application**, and the `SecurityFields` both forms that create one are built from |
| `components/salaries/` | The Salaries screen ([§8](../functional/specs/08-salaries.md)): the two tabs, the contract selector that scopes the first of them, the contracts table and its form, the per-year table whose working-days cell opens the one-field form that **is** the ContractYear record, the twelve-column payslip table and its form, and the two charts |
| `components/checks/ChecksScreen.tsx` `.css` | The Checks screen ([§9](../functional/specs/09-checks.md)): the fourteen in the order of the specification's table, each stating what it looks for and its reach, each failing one naming at most five records with the whole count and a link per record. A threshold inside a check's sentence is drawn as a control of its own, and following it lands on the preference that set it |
| `components/portfolio/` | The Portfolio screen ([§3](../functional/specs/03-portfolio.md)): the failing-check banner, the headline with the four lines that add to it and their notes, the *gains and costs* card, the breakdown by type with its pie, the net worth line with its two series, and the breakdown by account that totals back to the headline |
| `contexts/ChecksContext.tsx` | The one place the fourteen checks run and the five pairings are derived: undebounced on opening a file, debounced after every change, superseded by the next ([§9](../functional/specs/09-checks.md)) |
| `contexts/LedgerContext.tsx` | The ledger in memory, the autosave, the save state, the storage lines |
| `contexts/PreferencesContext.tsx` | The thirteen preferences, read once and written as they change, and the formatter they define |
| `contexts/ScreenMemoryContext.tsx` | What each screen is found showing when it is come back to, and the `useRemembered` a screen holds a field in ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)) |
| `contexts/UnsavedDraftContext.tsx` | The guard every departure goes through, and the draft a screen registers with it ([§1.3](01-architecture.md#13-layers-inside-the-renderer)) |
| `i18n/Translations.ts` | Turns a language into a translator; the bundle registry |
| `i18n/TranslationContext.tsx` | The React binding of that translator |
| `i18n/lang/en.ts` | Every word the user can read |
| `logic/accounts/Accounts.ts` | Everything pure about accounts and institutions: the two orderings, *Institution · Account*, the two counts, the uniqueness rules and what an account picker offers |
| `logic/categories/Categories.ts` | The two category orderings — alphabetical, which every picker, filter and list reads, and the stored `order`, which only the report does — the index a chip reaches a name through, and the live count the list tab shows |
| `logic/categories/Categorisation.ts` | The rule engine: what a rule compares, which rule claims a description, the pass that keeps an `automatic` category the one the rules produce, what each rule accounts for, and the four figures applying a list would produce |
| `logic/categories/RuleDraft.ts` | The draft the rule list is edited as, and what tells it apart from the list the file holds |
| `logic/categories/CategoryReport.ts` | The categories × years matrix: the columns, the four groups, the three subtotals and Net |
| `logic/checks/Matching.ts` | The five pairings of [§11.6](../functional/specs/11-calculations.md#116-derived-matching) and the one bucketed walk all of them are made of, displacement included, plus what the three *Matched* columns name |
| `logic/checks/Checks.ts` | The fourteen checks of [§9](../functional/specs/09-checks.md), in that document's order: the sentence each one says it looks for — stating the thresholds the run actually used, in runs so that each threshold links to its preference — what each one examined, the records a failing one names, the way back to each of them, and how far the file's own transactions reach, which is what checks 4 and 5 set a not-yet-recorded expectation aside against |
| `logic/checks/CheckDates.ts` | The day arithmetic the windows, the ages and the net worth line's month ends are written in |
| `logic/portfolio/NetWorth.ts` | Every account's balance and the four lines net worth divides into, in one pass, plus the pension fund half of [§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation) with its two clamps |
| `logic/portfolio/GainsAndCosts.ts` | The five lifetime figures of the *gains and costs* card, the sales the realised gain leaves out, and the total that carries the same omission |
| `logic/portfolio/TypeBreakdown.ts` | The breakdown by type: which of the eleven are present, what each is worth, the shares against the positive total, and the one ordering that is by amount |
| `logic/portfolio/NetWorthSeries.ts` | Net worth at every month end of the file and one final point at today, with the per-point fallback to cost of [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) |
| `logic/investments/Holdings.ts` | The weighted-average-cost walk in its one order, the realised gain a sale leaves, the holdings that survive it, and what each one would leave you with if it were sold today |
| `logic/investments/AnnualisedReturn.ts` | The money-weighted return: the flows a position produces, the bisection that solves them, and every case that has no figure |
| `logic/investments/Trades.ts` | Everything pure about the two trade tables: the one ordering and the two directions it is read in, the three filters, the derived total and what the footers sum |
| `logic/investments/Securities.ts` | The ticker ordering, what points at a security, what makes an ISIN a duplicate, and the price history — which day a record lands on, what a bulk clearing takes off one security, and when a price has gone stale |
| `logic/investments/PriceUpdate.ts` | Everything pure about a price pass: what the modal offers to ask for, the listings that go out, what came back read against the file, and the records confirming it would write |
| `logic/salaries/Contracts.ts` | Everything pure about a contract: the ordering, the years it covers, what falls inside its life, and what a narrowing or a deletion would run into |
| `logic/salaries/Payslips.ts` | Which contract and which year a payslip belongs to, the order the table shows it in, and `netSalary` — the one derived field on the record |
| `logic/salaries/SalaryFigures.ts` | The salary figures of [§11.7](../functional/specs/11-calculations.md#117-salary-figures): one row per year, the years that read 0, and the hourly rates that read *undefined* |
| `logic/transactions/Transactions.ts` | Everything pure about the list: the one ordering and the two directions it is read in, the seven filters, the footer total, the pages, and what a duplicate carries over |
| `logic/transactions/TransactionImport.ts` | Everything pure about a paste: how a line becomes a row, what makes one unreadable, which rows the file already holds, and what the ticked ones are written as |
| `logic/format/DateFormat.ts` `NumberFormat.ts` | Printing a day and printing a figure, the way the preferences say — including the compact amount a chart's value axis writes, which is the one place a figure is not printed in full |
| `logic/format/Formatter.ts` | Both of those, bound once to the preferences in force |
| `logic/format/FilePathDisplay.ts` | Reading a path apart for display |
| `logic/menu/DrawnMenu.ts` | The only module that touches the menu bridge: what to draw, when it changed, and what a click asks for |
| `logic/ledger/` | The document: its version, its seed, its reader, its writer, its refusals and its upgrade ([§9](09-file-format.md)) |
| `logic/money/Money.ts` | The scales, the one division rule and the roundings |
| `logic/preferences/Preferences.ts` | The defaults, the reading of whatever the configuration file holds, and the rule that the two separators must differ — which Settings and the import's own controls both apply |
| `logic/storage/AutosaveScheduler.ts` | The debounce, and the rule that two writes never overlap. **Every write of the open file goes through it**, the blocking failure message's own *Retry* included, and nothing that leaves its queue goes unreported — a save that rejects becomes a failed write rather than vanishing |
| `types/AppInfoTypes.ts` `AppInfoIpcChannels.ts` | The shape and the channel names of the app-info request |
| `types/AppMenuTypes.ts` `AppMenuIpcChannels.ts` | The drawn menu's description, its closed set of commands, and the channel names |
| `types/LedgerTypes.ts` | The eleven stored entities and every closed set they take |
| `types/LedgerIpcTypes.ts` `LedgerIpcChannels.ts` | What crosses the bridge for storage, and the channel names |
| `types/PriceIpcTypes.ts` `PriceIpcChannels.ts` | What crosses the bridge for a price pass, and the four channel names |
| `types/PreferencesTypes.ts` | The thirteen preferences and the recent-file list |
| `types/ElectronSquirrelStartup.d.ts` | Types for a dependency that ships none |

## 2.5 `tests`

| Path | Purpose |
| --- | --- |
| `setupTests.ts` | Runs before every test file: the Testing Library timer shim and a deterministic `crypto.randomUUID` |
| `vitest-env.d.ts` | Declares the Vitest globals the config enables |
| `framework/` | The framework's own tests, which depend only on framework modules |
| `main/` | Tests for the Electron main process modules |
| `logic/` | Tests for the pure logic: the money arithmetic, the reader, the writer, the upgrade, the autosave, the preferences, the calculations of each screen — and `FileFormat.test.ts`, which checks [§9](09-file-format.md) itself against the reader |
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
| `write-sample-ledger.js` | Writes a `.spiccioli` file from [§9](09-file-format.md) alone, importing nothing from `src` — the worked example a migration script starts from, and what `tests/logic/FileFormat.test.ts` holds §9 to |

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
