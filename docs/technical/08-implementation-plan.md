# §8 — Implementation plan

*[Index](README.md) · [← §7 Testing](07-testing.md)*

The route from the scaffolding that exists today to the application [`docs/functional/`](../functional/README.md) specifies. **This is the one page in this set that describes work not yet done**, and it is kept current: a phase that lands is marked done here in the same commit, and the pages it changed are updated with it.

It carries three things: the **decisions** ([§8.2](#82-decisions)) — those taken, with what they were taken on, and those still open — the **shape the code is heading towards** ([§8.4](#84-the-shape-of-the-code)), and the **twelve phases** the work is cut into ([§8.5](#85-the-phases)). Where a section cannot be written until a decision is taken it says **to be completed** and names the decision.

---

## 8.1 How the phases are ordered

Three constraints fix the order, and everything else follows from them.

- **Nothing can be built before there is a file to put it in.** [§12](../functional/specs/12-storage.md) is the foundation: the domain model, the file, autosave, backups and the launch screen come first because every screen writes through them.
- **The screens are ordered by what they depend on, not by what is most wanted.** Accounts is the spine ([§4](../functional/specs/04-accounts.md)), Transactions hangs off it, Categories reads Transactions, Investments and Salaries stand on their own, Checks reads everything, and Portfolio reads everything including Checks. Portfolio is the home screen and is built last.
- **Every formula in [§11](../functional/specs/11-calculations.md) is pure and is written test-first**, in the phase of the screen that first shows it, before that screen is built. It is the highest-risk correctness area in the application and the cheapest to test in isolation.

Each phase leaves the application **running, linted, typechecked and tested**. A phase is not a branch and not a release; it is a unit of review.

## 8.2 Decisions

Each of these has to be settled before the phase that names it can start. The first table is what has been settled, and what it was settled on; the second is what is left, and is the agenda.

### Taken

| # | Decision | Blocks | Taken | On what grounds |
| --- | --- | --- | --- | --- |
| D1 | **The ledger file format**, and its extension ([§12](../functional/specs/12-storage.md)) | Phase 1, and the file-format document | **JSON, one document, extension `.spiccioli`** | D2 puts the whole model in memory, so the file is only ever read whole and written whole — and a database engine then carries all of its costs and delivers none of its benefits. Argued and measured in [*Why D1 went the way it did*](#why-d1-went-the-way-it-did) below |
| D2 | **Which process holds the ledger** | Phase 1 | **The renderer holds the model.** The main process owns the file and nothing else | Every figure in [§11](../functional/specs/11-calculations.md) is derived on read and none of it is expressible as a query — the weighted-average-cost walk terminates early on its own running total ([§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost)), the annualised return is a bisection ([§11.8](../functional/specs/11-calculations.md#118-annualised-return)), and the five matchers are greedy one-to-one claims with stated tie-breaks ([§11.6](../functional/specs/11-calculations.md#116-derived-matching)). All of it wants the whole history as an ordered array in the process the screens are in |
| D3 | **How money, quantities and rates are represented** | Phase 1, every entity | **Integer minor units** — cents for amounts, ten-thousandths for quantities, prices and rates, with a working scale of eight decimal places for what a product lands in. Set out field by field in [*What D3 fixes*](#what-d3-fixes) below | [§13](../functional/specs/13-validation.md) admits a fixed number of decimals in every numeric field, so each stored figure already *is* an integer at its own scale, and storing it as one makes the limit a property of the type rather than a check on a float. It is also what [§11](../functional/specs/11-calculations.md) rests on: sums and differences stay exact, so net worth divides into four "by construction and not by reconciliation" ([§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth)) and the matchers compare cent-exact totals with no tolerance to invent ([§11.6](../functional/specs/11-calculations.md#116-derived-matching)). **Binary64 cannot honour a rule that names three mid-calculation roundings**, because under it every operation is one; [§11.8](../functional/specs/11-calculations.md#118-annualised-return) is the single place the specification requires it, and it stays so |
| D4 | **The schema version scheme**, and what "not understood" means concretely ([§12](../functional/specs/12-storage.md)) | Phase 1 | **An integer `schemaVersion`**, the first key of the document, incremented once per shape change | A semantic version implies a compatibility rule this format does not have: [§12](../functional/specs/12-storage.md) gives a file exactly three positions — current, older, not understood — and an integer expresses all three. **"Not understood" is exhaustive validation**: the reader rejects an unknown key, an unknown category, an unknown role and an unknown enum value rather than ignoring extras, which is the natural shape of a reader over a parsed document |
| D5 | **Where the new storage layer lives** | Phase 1 | **`src/framework/main/storage/`.** Only what is Spiccioli-specific stays in `src/main` | Atomic whole-file autosave, five spaced retries, rotation by count and external-modification detection are described without ever naming a ledger, which is [§4.5](04-framework.md#45-adding-to-it)'s test. The ledger document, its schema and its reader and writer are Spiccioli's and stay in `src/logic`; the framework moves bytes and knows nothing of what is in them |
| D6 | **What becomes of the framework's unused storage modules** ([§4.3](04-framework.md#43-what-is-present-and-not-used-yet)) | Phase 1 | **Keep all of them, none deleted** | [§4.1](04-framework.md#41-what-it-is) keeps this folder byte-identical to SPOT's copy on purpose. Deleting the modules Spiccioli happens not to use would diverge the two for no gain and make the next carried fix more expensive than the unused code is. They stay compiled, linted and tested, and [§4.3](04-framework.md#43-what-is-present-and-not-used-yet) records why each is idle |
| D7 | **Routing between the eight screens** | Phase 2 | **`react-router` in declarative mode, over a `HashRouter`** | Taken to prepare for screens and links this version does not have. **It buys nothing today and that is understood**: [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open) remembers no screen, no tab, no filter and no selection, so the price is one dependency and one provider against a shape that is ready when something does need a URL. **Framework mode is what [`CLAUDE.md`](../../CLAUDE.md) bans and it is not used** — no `@react-router/dev`, no route modules, no loaders, no actions, no SSR; nothing owns rendering or the component model. **`HashRouter` and not `BrowserRouter`**, because a packaged run loads `build/index.html` over `file://`, where a path-based history resolves to nothing; it also survives a renderer reload, which `MemoryRouter` does not |
| D8 | **How the four charts are drawn** ([§3.1](../functional/specs/03-portfolio.md#31-behaviour), [§8.1](../functional/specs/08-salaries.md#81-payslips)) | Phase 11, Phase 9 | **`recharts`** | **SVG, which is what settles it**: a colour stays `var(--…)` in the markup and the one dark theme stays in `src/index.css`, where a canvas library would have every colour read out with `getComputedStyle` and passed in as a string — the inline colour [§6](06-styling.md) refuses. Charts as components rather than an instance held in a ref is the rest of this code. **And the fourth chart stops being a fight**: the per-point dashed line of [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) is two series over one array — one *from prices*, one *from cost*, each `null` where the other holds, both carrying the boundary points — and [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) **already requires the legend to name those two stretches**, so the two series are the specified legend rather than a workaround. **The cost is the transitive tree**: recharts keeps its own state in Redux, so `@reduxjs/toolkit`, `react-redux` and `immer` come with it. They are the library's and never the application's — the ledger stays in a context (D2) |
| D9 | **The date picker** | Phase 2 | **Our own control, built on `react-datepicker`** | A native picker renders in the browser's locale and [§10](../functional/specs/10-settings.md) requires `dateFormat` to decide it. The library covers what a calendar has to get right — the popup, keyboard navigation, focus return — and the three `dateFormat` values map one-to-one onto its format strings, while `maxDate` is [§13](../functional/specs/13-validation.md)'s no-day-after-today. **The wrapper is the point**: `customInput` keeps typing and refusal ours ([§13.1](../functional/specs/13-validation.md#131-how-it-behaves)), and every screen sees our control and never the library, so swapping in a hand-rolled calendar stays a one-file change. **It ships a stylesheet of its own**, overridden to the theme variables and back to the single focus ring — the exception [`CLAUDE.md`](../../CLAUDE.md) allows a control that draws its own |
| D10 | **How rules are reordered** ([§6.2](../functional/specs/06-categories.md#62-rules)) | Phase 6 | **`@dnd-kit/react`** | Eleven-to-fifty rows do not need a library for the dragging; they need one for everything around it, and HTML5 drag events supply none of it. **What decided it is the keyboard**: `@dnd-kit/dom`, which comes with it, exports a `KeyboardSensor` and an `Accessibility` plugin, so a reorder has a keyboard path and a live region announcing it — and [§15](../functional/specs/15-out-of-scope.md) declining keyboard-shortcut work never meant a control the keyboard cannot reach. It **retires the risk this decision used to carry** ([§8.7](#87-risks)), on the condition that the drag handle is a real button |
| D12 | **The autosave debounce, the retry spacing and the write timeouts** | Phase 1 | **Debounce 2 s · 5 attempts spaced 3 s · write timeout 10 s**, all in `AppConfig` | [§12](../functional/specs/12-storage.md) fixes only the five attempts and "spaced a few seconds apart". **The debounce is a sync-traffic figure rather than a performance one** — a save costs 3 ms, but it rewrites the whole file, and a folder being synced re-uploads it every time. Two seconds is short enough that a crash loses nothing worth naming and long enough that typing a row does not queue an upload per keystroke |
| D13 | **How external modification is detected** | Phase 1 | **A SHA-256 of the whole file**, recorded at every read and every write and re-checked before the next write | mtime and size is the cheaper comparison and the wrong one: a sync client that preserves timestamps, a restore that puts back a same-sized file, and a filesystem with coarse mtime granularity each defeat it silently, and a *missed* external modification is the one failure in [§12](../functional/specs/12-storage.md) that destroys the other version without saying so. The hash costs **0,7 ms at real scale and 6,9 ms at ten times it**, against a write the user is not waiting on, and it removes the whole class rather than the common case |

### Still to be taken

| # | Decision | Blocks | Options | Leaning |
| --- | --- | --- | --- | --- |
| D11 | **The price provider** ([§7.6](../functional/specs/07-investments.md#76-prices)) | Phase 8 | — | **Open, and the riskiest item here.** The spec requires one built-in provider, named on screen, with **no endpoint, key or credential to configure**, taking an ISIN or a ticker and returning a quote, its date and **its currency**. A provider that cannot state the currency does not qualify. A compiled-in API key in a public repository is not a way to meet "nothing to configure". If no provider qualifies, that is a specification question to raise, not a thing to work around |

### Why D1 went the way it did

Recorded because it is the decision every other one in Phase 1 rests on, and because the numbers are what keep it from being reopened on a hunch. Measured on a synthetic ledger built to the eleven entities of [§2](../functional/specs/02-domain-model.md), on Node 24 — the runtime Electron bundles `node:sqlite` from.

**A realistic ledger is 17 656 records**: 4 000 transactions, 13 000 prices, 400 trades, 130 payslips, 15 accounts. Ten years of one person's finances.

| | JSON | `node:sqlite` |
| --- | --- | --- |
| On disk | 2,10 MB | 1,46 MB, **plus `-wal` and `-shm` while open** |
| Full load | **3,6 ms** | 2,5 ms |
| Full save — stringify, write, rename | **3,0 ms** | 0,1 ms per single-row update |
| Every account's balance | **0,1 ms**, in JS over the loaded array | 0,5 ms, in SQL |
| Backup copy | **0,5 ms**, `copyFile` | 4,4 ms, `VACUUM INTO` |
| JS heap for the parsed model | **2 MB** | the same, once loaded |

At **ten times that scale** — 40 000 transactions, further past anything this application will hold — JSON opens in 37 ms, saves in 25 ms and occupies 22 MB of heap. The aggregation worry inverts at that size: the in-JS pass over 40 000 transactions beats the SQL `GROUP BY` 0,7 ms to 9,4 ms, because the rows are already in the process and none of them have to be marshalled across a boundary.

**Three things decided it, and speed was the least of them.**

- **The file may live in a synced folder, and [§12](../functional/specs/12-storage.md) requires the application to make no assumption about where it is.** That rules out WAL outright — `-wal` and `-shm` must stay byte-consistent with the main file, and a sync client uploading them at different moments produces a corrupt ledger on the other machine. The framework's own [`AppDatabase.ts`](../../src/framework/main/storage/AppDatabase.ts) says as much in a comment, and says it about a database that is *never* in a synced folder. It also costs [§12](../functional/specs/12-storage.md) its first line: **one file** stops being true the moment a sidecar exists.
- **External-modification detection has no coherent recovery on a live connection.** Tested three ways. When something replaces the file by rename — which is what every sync client does, and what our own atomic save does — SQLite notices (`SQLITE_READONLY_DBMOVED`) but is left permanently read-only over a stale cache on an unlinked inode, with the session's work in a file that no longer has a name. When something overwrites the file in place, the stale read is **not** noticed and the next write goes straight over the incoming version, silently. **The mismatch is semantic rather than mechanical**: [§12](../functional/specs/12-storage.md) says to copy the version found on disk into the backup folder and carry on with *the session in memory, whose next save overwrites it* — and on a live connection there is no in-memory session distinct from the file for that sentence to refer to. Over a JSON document it is four lines and loses nothing on either side.
- **[§12](../functional/specs/12-storage.md) requires refusing a file carrying an unrecognised field.** Over a parsed document that is the reader's natural shape. Over SQLite every ordinary query succeeds regardless of what extra columns or tables the file holds, so catching it means deliberate `sqlite_master` and `PRAGMA table_info` introspection — exactly the kind of check that is written once and then quietly stops covering what is added later.

**What SQLite would genuinely have bought**, recorded so the decision stays argued: foreign keys enforcing the no-dangling-reference rule of [§12](../functional/specs/12-storage.md)'s upgrades in the engine rather than in a validator, row-level writes, and an [`AppDatabase.ts`](../../src/framework/main/storage/AppDatabase.ts) that already exists and is tested. The first is one rule where [§13](../functional/specs/13-validation.md) needs forty; the second is 3 ms against a debounce measured in seconds; and the third was built for a WAL database in the user-data folder with in-place migrations, which is the opposite of this file in every respect.

**The one thing that would reopen this is the model not fitting in memory.** It is 2 MB at real scale and 22 MB at ten times it, and the largest table is bounded by securities × days.

### What D3 fixes

Recorded because the representation reaches every entity, every formula and the file format, and because **"integer minor units" by itself does not say what happens at a division**, which is the only thing in [§11](../functional/specs/11-calculations.md) that cannot be exact.

**Every stored number is an integer**, at the scale its [§2](../functional/specs/02-domain-model.md) type fixes. [§13](../functional/specs/13-validation.md) is what makes that free: it already admits a fixed number of decimals in each field, so nothing legal is lost.

| [§2](../functional/specs/02-domain-model.md) type | Fields | Stored as |
| --- | --- | --- |
| `amount` | every monetary field — balances, amounts, fees, taxes, prices paid, every figure on a payslip | **cents**, two decimal places |
| `decimal(4)` | `quantity`, `unitPrice`, a Price's `value` | **ten-thousandths**, four decimal places |
| `fraction` | `taxRate`, `exitTaxRate`, `defaultTaxRate` | **ten-thousandths**. [§13](../functional/specs/13-validation.md) enters them as a percentage with at most one decimal, so 26% is `2600` and 12,5% is `1250`, with a digit to spare |
| `decimal(2)` | `hoursPerDay` | **hundredths** |
| `int` | `workingDays`, `monthsPerYear`, a category's `order`, the match windows of [§10](../functional/specs/10-settings.md), `insertionSeq`, `schemaVersion` | as they are |

**Two things follow at once.** A file round-trips exactly, because no figure in it was ever the nearest binary64 to something else. And **rounding at display is a no-op on every figure that is a sum of stored amounts** — an account balance, a table footer, a yearly total, net worth and the four lines that decompose it — so [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth)'s "by construction and not by reconciliation" is arithmetic rather than an aspiration, and the exact-total comparisons of [§11.6](../functional/specs/11-calculations.md#116-derived-matching) need no epsilon and therefore no tie-break rule the specification does not have.

**The working scale is eight decimal places, and only a division ever leaves it.** A quantity times a unit price lands there exactly — four decimals by four — and an amount widens into it, so every sum, difference and product in [§11](../functional/specs/11-calculations.md) is exact. **Division is the only inexact operation in the application**: it rounds half away from zero at the working scale, six orders of magnitude below the cent anything is ever shown at, and it is what `avgCost = costBasis ÷ quantity` and the cost basis a sale leaves behind ([§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost)), the gain percentages, the salary averages and the hourly rates ([§11.7](../functional/specs/11-calculations.md#117-salary-figures)) are computed with.

**The deliberate roundings to the cent stay exactly the three [§11](../functional/specs/11-calculations.md) names** — the hypothetical capital-gains tax, the pension exit tax and the totals the matchers compare — plus the display. All of them round half away from zero, which is symmetric on a negative figure where the language's own `Math.round` is not, and [§11.6](../functional/specs/11-calculations.md#116-derived-matching) compares signed totals.

**Nothing here needs a dependency.** A `number` holds an integer exactly to 2⁵³, which is just over 90 000 000 000 000 € in cents and just over 90 000 000 € at the working scale. **The second is the one that binds**, being the ceiling on any single figure a product or a division touches — a holding's value, an account's balance, net worth itself — and it is orders of magnitude past what a personal ledger holds. No `bigint`, no decimal library, and the arithmetic lives in `src/logic` beside the formatters that read it. **[§11.8](../functional/specs/11-calculations.md#118-annualised-return) is the one exception and is specified as one**: the bisection is IEEE-754 binary64 throughout, because a fixed count of halvings is only a fixed answer if the halving is the same operation on every machine.

**The conversion happens once at each boundary, and there are four of them** — the amount field of [§13.1](../functional/specs/13-validation.md#131-how-it-behaves), the import parser of [§5.7](../functional/specs/05-transactions.md#57-bulk-import), the reader and the writer. **The reader refuses a figure that is not an integer at its field's scale exactly as it refuses an unknown key** (D4): a fraction of a cent in the file is a file this application did not write, and it is not silently rounded away.

### The dependencies D7 – D10 add

Four libraries, and they are the whole of what v1 adds to the five runtime dependencies `package.json` holds today. **Each arrives in the phase that needs it and not before**, at an exact version, and none of them is installed yet. The versions below are what was published when the decisions were taken; a phase installs the current one and pins it.

| Package | Version then | Arrives in | What comes with it |
| --- | --- | --- | --- |
| `react-router` | 7.18.2 | Phase 2 | Nothing. Version 7 folds the DOM exports into the one package, so `react-router-dom` is a re-export and is not installed |
| `react-datepicker` | 9.1.0 | Phase 2 | `date-fns` and `@floating-ui/react`. `date-fns-tz` is an **optional** peer and stays uninstalled — nothing in this application has a time zone in it |
| `@dnd-kit/react` | 0.5.0 | Phase 6 | `@dnd-kit/dom`, `@dnd-kit/state` and `@dnd-kit/abstract`, all of them the same project's |
| `recharts` | 3.10.1 | Phase 9 | `@reduxjs/toolkit`, `react-redux`, `immer`, the d3 modules of `victory-vendor` and a handful of small utilities — much the largest tree of the four |

**Every one of them is wrapped where it meets a screen**, which is what keeps the choice reversible: the date picker behind our own control (D9), each chart behind a component of its own, the drag behind the rule list. **What the rest of the code imports is Spiccioli's component and never the library**, so replacing any of the four is a change in one folder.

**None of them owns anything.** `react-router` is taken in declarative mode only and the ban in [`CLAUDE.md`](../../CLAUDE.md) still stands against its framework mode; recharts' Redux store is internal to recharts and is not a state library this application may reach for — the ledger lives in a context (D2) and nothing else is allowed to hold it.

**`@dnd-kit/react` is the one to re-check.** At 0.5.0 it is pre-1.0 — the project's newer React package, whose API can still move under a minor bump — and Phase 6 is a long way off. It is pinned exactly like everything else, and **if it is still 0.x when Phase 6 starts, the fallback is the same project's settled pair**, `@dnd-kit/core` with `@dnd-kit/sortable`: the keyboard sensor and the accessibility layer that decided D10 are in both, so the fallback costs an API and no capability.

## 8.3 What is already fixed, and is not up for decision

Restated here so a phase does not reopen it: everything in [`CLAUDE.md`](../../CLAUDE.md), and from the analysis — EUR only with no currency anywhere, English only through the translation layer, one dark theme, derived data never stored except the assigned category, twenty-seven seeded categories that no runtime editor touches, no undo, checks that report and never prevent, and the whole of [§15](../functional/specs/15-out-of-scope.md).

## 8.4 The shape of the code

Where the new folders go. `src/framework` keeps the rule of [§4](04-framework.md) throughout: nothing below imports upwards.

| Path | Holds |
| --- | --- |
| `src/types/` | The eleven stored entities and the derived holding of [§2](../functional/specs/02-domain-model.md), the ledger document, the preferences |
| `src/logic/` | Everything pure and testable with no React in it: **the ledger document — its schema, its reader and its writer** (D1, D5) — the categorisation pass, the [§11](../functional/specs/11-calculations.md) calculations, the [§11.6](../functional/specs/11-calculations.md#116-derived-matching) matchers, the fourteen checks, the import parser, **the money arithmetic of D3** — the scales, the one division rule and the roundings [§11](../functional/specs/11-calculations.md) names — and the formatters that turn a stored figure into what [§10](../functional/specs/10-settings.md) says it looks like |
| `src/contexts/` | The ledger in memory, the preferences, the save state, the check results — the four things every screen reads |
| `src/components/common/` | The kit of [§8.5](#85-the-phases) phase 2: the amount field, the date picker, the table, the row menu, the confirm dialog, the filter bar, the empty state |
| `src/components/<screen>/` | One folder per sidebar item, plus `launch/` and `import/` |
| `src/framework/main/storage/` | **Per D5**, the generic half: reading and writing a whole file, atomic replace by temp-file-and-rename, the five spaced retries, backup rotation by count, and hash-based external-modification detection. It moves bytes and never learns what is in them; the ledger's own shape is `src/logic`'s, above |
| `src/main/storage/` | The Spiccioli half: where a ledger's backup folder is, what a copy is named, and the IPC the renderer saves through |
| `src/main/menu/` | The File menu and the About item of [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open) |

**Every user-facing string added anywhere goes into `src/i18n/lang/en.ts`** ([§5](05-text-and-languages.md)), and every tunable value into `src/config/AppConfig.ts`. Neither is restated in the phases below; both apply to all of them.

## 8.5 The phases

| # | Phase | Specification | Depends on |
| --- | --- | --- | --- |
| 1 | [The file](#phase-1--the-file) | [§2](../functional/specs/02-domain-model.md), [§12](../functional/specs/12-storage.md) | — |
| 2 | [The shell and the kit](#phase-2--the-shell-and-the-kit) | [§10](../functional/specs/10-settings.md), [§13.1](../functional/specs/13-validation.md#131-how-it-behaves), [§14](../functional/specs/14-empty-and-error-states.md) | 1 |
| 3 | [Accounts and institutions](#phase-3--accounts-and-institutions) | [§4](../functional/specs/04-accounts.md) | 2 |
| 4 | [Transactions](#phase-4--transactions) | [§5.1](../functional/specs/05-transactions.md#51-columns) – [§5.6](../functional/specs/05-transactions.md#56-selecting-and-deleting-in-bulk) | 3 |
| 5 | [Bulk import](#phase-5--bulk-import) | [§5.7](../functional/specs/05-transactions.md#57-bulk-import) | 4 |
| 6 | [Categories](#phase-6--categories) | [§6](../functional/specs/06-categories.md) | 4 |
| 7 | [Investments](#phase-7--investments) | [§7.1](../functional/specs/07-investments.md#71-holdings) – [§7.5](../functional/specs/07-investments.md#75-recording-a-trade-and-where-securities-come-from), [§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost) – [§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation), [§11.8](../functional/specs/11-calculations.md#118-annualised-return) | 3 |
| 8 | [Update prices](#phase-8--update-prices) | [§7.6](../functional/specs/07-investments.md#76-prices) | 7, D11 |
| 9 | [Salaries](#phase-9--salaries) | [§8](../functional/specs/08-salaries.md), [§11.7](../functional/specs/11-calculations.md#117-salary-figures) | 2 |
| 10 | [Matching and checks](#phase-10--matching-and-checks) | [§9](../functional/specs/09-checks.md), [§11.6](../functional/specs/11-calculations.md#116-derived-matching) | 4, 7, 9 |
| 11 | [Portfolio](#phase-11--portfolio) | [§3](../functional/specs/03-portfolio.md), [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth), [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) | 10 |
| 12 | [Release readiness](#phase-12--release-readiness) | [§12](../functional/specs/12-storage.md) | 11 |

### Phase 1 — The file

The domain model and everything [§12](../functional/specs/12-storage.md) asks of the file. No screens beyond the launch one.

- The eleven stored entities of [§2](../functional/specs/02-domain-model.md) as types, **every number an integer at the scale D3 fixes**, and the money arithmetic beside them — the widening into the working scale, the one rounding rule for a division, and the conversions the amount field and the reader go through. `id` generation, and `insertionSeq` monotonic per entity and never reused.
- **The ledger document as JSON** (D1), extension `.spiccioli`, with the integer `schemaVersion` of D4 as its first key. Its reader and writer live in `src/logic` and are pure: bytes in, model out, and nothing about a filesystem in either.
- **The reader validates exhaustively** (D4). **A file at a later version, or at a known version carrying an unrecognised key, category, role or enum value — or a figure that is not an integer at its field's scale (D3) — is refused with a statement of what was not understood.** Ignoring extras is what this must not do. There is no read-only mode.
- **The storage layer split of D5**: the framework gets whole-file read and write, atomic replace, the retries, the rotation and the hash comparison, all of it knowing nothing about ledgers; `src/main/storage` supplies the ledger's paths, its backup names and the IPC, and `src/logic` supplies the document.
- **The twenty-seven categories of [§6.3](../functional/specs/06-categories.md#63-category-list) seeded**, with their types, roles, order and `receiptTracked`, into every new file.
- Autosave: debounced, written to a temporary file in the same directory and renamed. **Five retries, spaced**, with the save state and the on-screen line while they run and the blocking *Retry* after the fifth. The three figures of D12 come from `AppConfig`.
- **External-modification detection by SHA-256** (D13): the hash of the bytes is recorded at every read and every write, re-computed from the file before the next write, and a mismatch copies the displaced version into the backup folder and carries on with the session in memory. The line that says so is in [§12](../functional/specs/12-storage.md)'s own words with `backupCount` interpolated.
- The backup folder beside the ledger, named for it; the three copy names; **rotation as copies arrive, oldest out first**; one copy per session on close, only if something changed, through all four doors.
- Preferences and the recent-file list through `JsonConfigStore`, in the paths of [§1.6](01-architecture.md#16-where-the-installations-own-files-live).
- The launch screen ([§12.1](../functional/specs/12-storage.md#121-the-launch-screen)): recent locations, *Open…*, *New file…* which writes the seeded file at the moment the location is chosen, struck-through entries for files that moved. `PlaceholderPage` goes away here.
- The File menu, *Open Recent*, the About item, and the window title carrying the file's name.
- **The upgrade path is built and has nothing to upgrade yet**: version comparison, the pre-upgrade backup that stops the upgrade when it fails, and the dialog of [§12.1](../functional/specs/12-storage.md#121-the-launch-screen). No migration step is registered until there is a second schema version.

*Done when* a file can be created, closed, reopened, backed up, rotated, displaced by an external write and refused when unreadable — and the storage layer's tests say so without a screen.

**The file-format document is a deliverable of this phase** and becomes `docs/technical/09-file-format.md`: [§12](../functional/specs/12-storage.md) requires the format documented well enough for the one-off migration script to write it. With D1 and D3 taken it is writable in full — the shape of the document, every key of every entity with the scale its figure is written at, the `schemaVersion` rule, what makes a file *not understood*, and a worked example small enough to read and complete enough to open.

### Phase 2 — The shell and the kit

Everything every later screen is made of.

- The sidebar: eight screens, the failing-check badge, the save state. **`react-router` in declarative mode over a `HashRouter`** (D7), one route per screen, and the router installed once at the root. **An opened file lands on Portfolio with no filter set anywhere.**
- The kit: the amount field of [§13.1](../functional/specs/13-validation.md#131-how-it-behaves) — one control, at most two decimals, the decimal character `decimalSeparator` names and no thousands separator typeable, with the four-decimal variant for prices and quantities; the date picker of D9 — our control over `react-datepicker`, its stylesheet overridden to the theme and to the one focus ring, `maxDate` at today and `dateFormat` mapped onto its format string; the table with its footer; the row menu; the confirm dialog; the inline-edit cell that keeps a refused value out and never leaves a row half-changed; the filter bar; the empty state; the chip.
- **Formatting**, reading the preferences: `€` before every amount, exactly two decimals everywhere, four on quantities and prices, one on percentages, dates in `dateFormat`, the separators, and a percentage shown from the fraction stored ([§11](../functional/specs/11-calculations.md)).
- The Settings screen ([§10](../functional/specs/10-settings.md)): ten preferences, no save button, refusal in place, the two read-only paths, the line saying preferences do not live in the file.
- The eight screens as shells honouring [§14](../functional/specs/14-empty-and-error-states.md): every empty state names the action that fills it, and empty-because-of-a-filter is a different state from empty-because-nothing-exists.

*Done when* changing a preference re-renders every figure on screen immediately, and every screen exists with its empty state.

### Phase 3 — Accounts and institutions

The spine, and the first full CRUD — which is where the validation rules of [§13](../functional/specs/13-validation.md) get built once and reused.

- Both tabs, both forms, the orderings of [§4.1](../functional/specs/04-accounts.md#41-accounts) and [§4.2](../functional/specs/04-accounts.md#42-institutions), the transaction and trade counts, the five em-dashed columns.
- The rules that later phases lean on: uniqueness, **deletion refused while something points at the record**, the cash/brokerage type lock, the institution field disabled on `Cash`, the exit tax field that appears only on `Pension fund`.
- *Institution · Account* as the one way an account is written, and the three screens that are the exception.
- **Every account picker in the application is built here**, filtered to cash or to brokerage accounts, closed ones marked and last ([§2](../functional/specs/02-domain-model.md)).

### Phase 4 — Transactions

The screen with the most hours on it.

- The list: the columns of [§5.1](../functional/specs/05-transactions.md#51-columns) less *Matched*, which arrives with phase 10; `date ASC, insertionSeq ASC, id ASC`; 50 rows a page, opening on the last one.
- The seven filters of [§5.3](../functional/specs/05-transactions.md#53-filters), each taking one value or none, and the rule that changing one lands on the last page of what it now matches.
- Inline editing of every cell, the add form of [§5.5](../functional/specs/05-transactions.md#55-add-transaction), duplicate, delete, and the bulk selection and delete of [§5.6](../functional/specs/05-transactions.md#56-selecting-and-deleting-in-bulk).
- **The categorisation invariant of [§2](../functional/specs/02-domain-model.md), as a pure pass in `src/logic`**: first match wins, `manual` is never overwritten, and the pass runs on creation, on a description edit of an `automatic` row, and on a row switched back to *Automatic*. The Rules *screen* is phase 6; the engine is here, because the invariant has to hold from the first transaction written.

### Phase 5 — Bulk import

Self-contained, and the only text the application parses.

- One screen, live preview, the three format controls opening at their preferences and changing nothing outside the paste.
- The date rules, the amount rules and the `€`/`EUR` stripping of [§5.7](../functional/specs/05-transactions.md#57-bulk-import), each unreadable row marked with its reason and unticked.
- Duplicate detection on account + date + amount + normalised description, flagged and unselected, never compared within the paste.
- Consecutive `insertionSeq` in pasted order, `categorySource = automatic`, `receiptState = na`, and the hand-off to Transactions filtered to the account and the date range.

*Done when* the parser's tests cover every unreadable case in [§5.7](../functional/specs/05-transactions.md#57-bulk-import) and [§15](../functional/specs/15-out-of-scope.md)'s list of shapes that are deliberately not read.

### Phase 6 — Categories

- **Category list tab**: read-only, alphabetical, with the live transaction count.
- **Rules tab**: the draft session that writes nothing until *Apply changes*; the four-figure consequence summary; the write of rules and categories in one step; the unsaved-draft prompt with **discard and stay and no apply**; the *Applies to* column counting first-match `automatic` rows only, dimmed while a draft is pending; reordering per D10, with `@dnd-kit/react` — **the drag handle is a real button and the keyboard sensor reorders from it**, and what it announces is translated like everything else ([§5](05-text-and-languages.md)).
- **Report tab**: the categories × years matrix in `order`, four groups, the three subtotals and Net, *Last 5* and *All*, the account filter, em dashes for nothing recorded, and every category cell and row total a link that hands its filters to Transactions.

### Phase 7 — Investments

The largest calculation surface in the application, and written test-first.

- `src/logic`: **the walk of [§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost)** in its exact order, purchases before sales on a shared date, ending the moment a position goes below zero and deriving nothing thereafter; the realised gain of [§11.2](../functional/specs/11-calculations.md#112-realised-gain-on-a-sale) and its *undefined*; the hypothetical liquidation of a holding ([§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation)); the annualised return of [§11.8](../functional/specs/11-calculations.md#118-annualised-return) by bisection over `[−0,999 , 10]`, halved 100 times, in binary64, with every one of its *undefined* cases.
- **Securities tab**: creation, correction, the full editable price history newest-first with its `source` column, deletion taking the prices with it.
- **Purchases and Sales**: creation with inline security creation, in-place editing, the filters, the footers, `kind` locked once the trade exists.
- **Holdings**: the derived table, the inline price editor writing a Price for a day and replacing what it held, *Last priced* with the staleness highlight, the detail panel with the full liquidation breakdown and its caveat, and the two footers — the gross money totals, and the portfolio-wide annualised return that states what it left out.

### Phase 8 — Update prices

Gated on D11, and the only thing in the application that touches the network.

**To be completed — depends on D11.** What is fixed regardless: one button, no selection and no setting; **nothing written before the review panel is confirmed**; the panel reporting what got a quote with the day it belongs to and what that day currently holds, what had no quote, what could not be fetched with each reason, and the provider's reference date; refusal of a future-dated quote, of a quote of zero or less, and of any quote not stated in EUR; a cancelled or failed pass leaving no trace in the file; and the statement of what leaves the machine, beside the button and again in the panel.

### Phase 9 — Salaries

- **Contracts tab**: creation and editing, the dates that cannot be narrowed past a payslip or a ContractYear, deletion refused while a payslip points at the contract.
- **Payslips tab**: the contract selector scoping everything, the per-year table with `workingDays` created by typing and deleted by clearing, the twelve-column payslip table with `netSalary` inserted after `carPayment`, the add form whose year picker holds only the contract's own years.
- `src/logic`: the figures of [§11.7](../functional/specs/11-calculations.md#117-salary-figures), including the years that read 0 and the hourly figures that read *undefined*.
- The two charts, per D8, in `recharts`: *Average per month, per year* over `yearAvgGross` and `yearAvgNet`, and *Totals per year* carrying total gross, total net salary and the contract line, which is dashed because it is a term rather than a measurement ([§8.1](../functional/specs/08-salaries.md#81-payslips)).

### Phase 10 — Matching and checks

- `src/logic`: **the five matchers of [§11.6](../functional/specs/11-calculations.md#116-derived-matching)**, each greedy, each stating its walk order, each claiming the nearest-dated unclaimed counterpart, each comparing signed amounts on cent-rounded totals, and **each side bucketed by amount** — which [§9](../functional/specs/09-checks.md) fixes as the intended implementation rather than a later optimisation.
- **The fourteen checks**, in the order of [§9](../functional/specs/09-checks.md), each naming at most five records with the whole count and the ordering of the screen those records live on.
- The runner: **at startup and after every change, debounced**, a run in flight superseded by the next, and no manual re-run.
- The Checks screen, the sidebar badge counting failing checks, and the *Matched* column on Transactions, Purchases and Sales that this phase finally fills in.

### Phase 11 — Portfolio

The home screen, and the last one, because every figure on it is somebody else's output.

- `src/logic`: the balances and the four-way decomposition of [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth); the pension fund half of [§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation) with its two clamps; the monthly series of [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) with its per-point fallback to cost.
- The failing-check banner; the headline and the four lines that add to it, each with its own note; the *gains and costs* card with its five lifetime figures, its total and the count of the sales it left out; the breakdown by type with its pie and its negative and zero rows; the net worth chart of D8 — **two `recharts` series over one array, *from prices* and *from cost*, which is the legend [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) requires rather than a way around a per-point dash**; the breakdown by account totalling to the headline.
- **The one assertion worth a test of its own:** the last point of the chart equals the headline to the cent, and the four lines sum to it by construction.

### Phase 12 — Release readiness

- `docs/technical/09-file-format.md` finished and checked against a script that writes a file the application opens.
- `README.md` and every page of this set reconciled with what was built; this page marked complete.
- The version raised in the commit the `v<version>` tag is put on, and the workflow run by hand once before the tag.

## 8.6 What every phase carries

Not repeated in the phases above, and true of all of them.

- **Strings into `src/i18n/lang/en.ts`**, plurals as plural entries, values through `{name}` placeholders ([§5](05-text-and-languages.md)).
- **Tests**: new logic in `src/logic`, `src/main` and `src/framework` comes with unit tests; one or two smoke tests per critical flow ([§7](07-testing.md)).
- **Controls, not clickable divs**, and the one focus ring ([§6](06-styling.md)).
- **`docs/technical/` updated in the same commit**, and this page's phase marked done.
- `npm run lint && npm run typecheck && npm test` green.

## 8.7 Risks

- **The price provider (D11) may have no qualifying candidate.** [§7.6](../functional/specs/07-investments.md#76-prices) requires no credential to configure and a stated currency, and most free quote APIs meet neither. Phase 8 is isolated for exactly this reason — the application is fully usable without ever pressing the button — but shipping without it needs a specification amendment, not a quiet omission.
- **Rule reordering had no keyboard path, and D10 is what supplies one.** [§6.2](../functional/specs/06-categories.md#62-rules) reorders by drag, [§15](../functional/specs/15-out-of-scope.md) declines keyboard-shortcut work, and [`CLAUDE.md`](../../CLAUDE.md) requires every control to be reachable and activatable by keyboard. `@dnd-kit/react` reconciles the three, its keyboard sensor and its live region being the part nobody would have built by hand — **on the condition that the handle is a real button rather than a draggable row**, which is a design decision Phase 6 has to make rather than inherit.
- **The representation of D3 has to hold at every boundary.** It is taken and it reaches every entity, so what is left is the four places a binary64 could put a fraction of a cent into the file — the amount field, the import parser, the reader and the writer — and nothing downstream would notice it. The reader refusing a non-integer is what turns that from a convention into a check, and it is the only one of the four that also catches a file somebody else wrote.
- **The [§11.6](../functional/specs/11-calculations.md#116-derived-matching) matchers are the subtlest code in the application** — five greedy pairings whose determinism the specification is explicit about. They are where a test suite earns its keep, and where a shortcut is most expensive.

## 8.8 Sections to be completed

| Where | Waiting on |
| --- | --- |
| [Phase 8 — Update prices](#phase-8--update-prices) | D11 |

---

[← §7 Testing](07-testing.md)
