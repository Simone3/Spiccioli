# §8 — Decisions

*[Index](README.md) · [← §7 Testing](07-testing.md) · [§9 The ledger file format →](09-file-format.md) · [why they went this way](08-decisions-why.md)*

The fourteen decisions the application was built to, and is still held to. Each one settles a question the code cannot answer twice: which format the file is in, how a figure is represented, which process holds the model, what reaches the log.

**This page states outcomes.** What each decision was taken *on* is in [`08-decisions-why.md`](08-decisions-why.md), the companion to it: the grounds decision by decision, the measurements behind D1, and the provider survey behind D11. That page is read when a decision is questioned; this one is read before changing an area one of them governs.

**The twelve-phase plan that carried these into the code is gone**, having been spent. What it built is described in the pages it changed — [§1](01-architecture.md), [§2](02-repository-map.md), [§4](04-framework.md), [§6](06-styling.md), [§7](07-testing.md) and [§9](09-file-format.md) — and every one of them describes the code as it is, which is the rule the rest of this set has always followed.

---

## 8.1 The fourteen decisions

| # | Decision | Taken |
| --- | --- | --- |
| D1 | **The ledger file format**, and its extension ([§12](../functional/specs/12-storage.md)) | **JSON, one document, extension `.spiccioli`**, read whole and written whole |
| D2 | **Which process holds the ledger** | **The renderer holds the model**, as an ordered array per entity. The main process owns the file and nothing else |
| D3 | **How money, quantities and rates are represented** | **Integer minor units** — cents for amounts, millionths for quantities, ten-thousandths for prices and rates, with a working scale of eight decimal places for what a product lands in. Set out field by field in [§8.2](#82-what-d3-fixes) |
| D4 | **The schema version scheme**, and what "not understood" means concretely ([§12](../functional/specs/12-storage.md)) | **An integer `schemaVersion`**, the first key of the document, incremented once per shape change. **"Not understood" is exhaustive validation**: the reader rejects an unknown key, an unknown category, an unknown role and an unknown enum value rather than ignoring extras |
| D5 | **Where the new storage layer lives** | **`src/framework/main/storage/`** for everything that moves bytes. Only what is Spiccioli-specific stays in `src/main`, and the document itself is `src/logic`'s |
| D6 | **What becomes of the framework's unused storage modules** ([§4.3](04-framework.md#43-what-is-present-and-not-used-yet)) | **Keep all of them, none deleted.** [§4.3](04-framework.md#43-what-is-present-and-not-used-yet) records why each is idle |
| D7 | **Routing between the eight screens** | **`react-router` in declarative mode, over a `HashRouter`.** Framework mode stays banned — no `@react-router/dev`, no route modules, no loaders, no actions, no SSR. `HashRouter` because a packaged run loads `build/index.html` over `file://` |
| D8 | **How the four charts are drawn** ([§3.1](../functional/specs/03-portfolio.md#31-behaviour), [§8.1](../functional/specs/08-salaries.md#81-payslips)) | **`recharts`**, which is SVG, so a colour stays `var(--…)` in the markup. The per-point dashed line of [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) is **two series over one array**, each `null` where the other holds, both carrying the boundary points — which is also what lets the tooltip name the state a point is in, as [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) requires |
| D9 | **The date picker** | **Our own control, built on `react-datepicker`**: `customInput` keeps typing and refusal ours, `dateFormat` maps onto its format string, `maxDate` is today, and its stylesheet is overridden to the theme and the one focus ring. Every screen sees our control and never the library |
| D10 | **How rules are reordered** ([§6.2](../functional/specs/06-categories.md#62-rules)) | **dnd kit**, for its `KeyboardSensor` and its accessibility layer — **on the condition that the drag handle is a real button**, which is what gives the keyboard something to reorder from. `@dnd-kit/react` was still pre-1.0 when the time came to install it, so it went to the named fallback: **`@dnd-kit/core` with `@dnd-kit/sortable`** |
| D11 | **The price provider** ([§7.6](../functional/specs/07-investments.md#76-prices)) | **Yahoo Finance's `v8/finance/chart` endpoint**, one request per listing, keyless, addressed by **`ticker` + `exchange`** — an ISIN does not identify a currency. The one endpoint answers both spans: `range=1d` read out of the `meta` for the latest quote, `period1`/`period2` read out of the daily bars for a history (never `range=max`, which is answered at monthly granularity). The bars taken are the **split-adjusted** closes and never `adjclose`, the file's own quantities being stated in today's shares ([§15](../functional/specs/15-out-of-scope.md)) and its dividends already held as transactions. The file stores neither Yahoo's symbols nor its suffixes: `exchange` is our own enum of eighteen eurozone venues ([§2](../functional/specs/02-domain-model.md)) and the suffix table lives in the adapter |
| D12 | **The autosave debounce, the retry spacing and the write timeouts** | **Debounce 2 s · 5 attempts spaced 3 s · write timeout 10 s**, all in `AppConfig` |
| D13 | **How external modification is detected** | **A SHA-256 of the whole file**, recorded at every read and every write and re-checked before the next write |
| D14 | **What is written to the operational log, and from where** | **One startup entry, every storage operation, and the renderer's own failures over IPC**, through `appLogger` ([§4.4](04-framework.md#44-the-logger)) at four levels. An entry carries counts, paths, versions, durations and reasons and **never a figure or a text out of the ledger**. Set out entry by entry in [§8.4](#84-what-d14-logs) |

## 8.2 What D3 fixes

**Every stored number is an integer**, at the scale its [§2](../functional/specs/02-domain-model.md) type fixes — which costs nothing, [§13](../functional/specs/13-validation.md) already admitting a fixed number of decimals in each field.

| [§2](../functional/specs/02-domain-model.md) type | Fields | Stored as |
| --- | --- | --- |
| `amount` | every monetary field — balances, amounts, fees, taxes, prices paid, every figure on a payslip | **cents**, two decimal places |
| `decimal(6)` | `quantity` | **millionths**, six decimal places. A broker selling fractional shares states one to six, and a quantity truncated to four would put the trade total off the bank's figure and fail checks 6 and 7 ([§11.6](../functional/specs/11-calculations.md#116-derived-matching)) |
| `decimal(4)` | `unitPrice`, a Price's `value` | **ten-thousandths**, four decimal places |
| `fraction` | `taxRate`, `exitTaxRate`, `defaultTaxRate` | **ten-thousandths**. [§13](../functional/specs/13-validation.md) enters them as a percentage with at most one decimal, so 26% is `2600` and 12,5% is `1250`, with a digit to spare |
| `decimal(2)` | `hoursPerDay` | **hundredths** |
| `int` | `workingDays`, `monthsPerYear`, a category's `order`, the match windows of [§10](../functional/specs/10-settings.md), `insertionSeq`, `schemaVersion` | as they are |

**Two things follow, and later sections rely on both.** A file round-trips exactly, and **rounding at display is a no-op on every figure that is a sum of stored amounts** — a balance, a table footer, a yearly total — so the exact-total comparisons of [§11.6](../functional/specs/11-calculations.md#116-derived-matching) need no epsilon.

**A figure a product went through is the other case, and a decomposition of such figures is where it shows.** A holding's cost and its net proceeds are both products, so the securities and gain lines of [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth) carry fractions of a cent that its cash and pension lines do not. The four still add to the headline exactly at the working scale — "by construction and not by reconciliation" is about the arithmetic and stays true — but rounding five figures independently can print a column that reads a cent or two off the total above it. **The display is what reconciles, and it reconciles the parts to the total and never the other way**: `narrowPartsFromWorkingScale` narrows the parts by largest remainder, so each lands within a cent of its own value and the headline stays the figure the chart's last point and the account table's total are also narrowed from ([§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time)).

**The working scale is eight decimal places, and only a division ever leaves it.** Every stored figure widens into it exactly, so every sum and difference in [§11](../functional/specs/11-calculations.md) is exact. **A quantity times a unit price is the one product that is not**: six decimals by four is ten, two places past the working scale, and it comes back by the same rounding division as everything else — at 10⁻¹⁰ of a euro, four orders of magnitude below the cent it is shown at. **Division is the only inexact operation in the application**: it rounds half away from zero at the working scale, six orders of magnitude below the cent anything is ever shown at, and it is what `avgCost = costBasis ÷ quantity` and the cost basis a sale leaves behind ([§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost)), the gain percentages, the salary averages and the hourly rates ([§11.7](../functional/specs/11-calculations.md#117-salary-figures)) are computed with.

**The deliberate roundings to the cent stay exactly the three [§11](../functional/specs/11-calculations.md) names** — the hypothetical capital-gains tax, the pension exit tax and the totals the matchers compare — plus the display. All of them round half away from zero, and never the language's own `Math.round`, which is not symmetric on a negative figure.

**Nothing here needs a dependency**: a `number` holds an integer exactly to 2⁵³, which is orders of magnitude past what a personal ledger holds at either scale. No `bigint`, no decimal library, and the arithmetic lives in `src/logic` beside the formatters that read it. **[§11.8](../functional/specs/11-calculations.md#118-annualised-return) is the one exception and is specified as one**: the bisection is IEEE-754 binary64 throughout.

**The conversion happens once at each boundary, and there are five of them** — the amount field of [§13.1](../functional/specs/13-validation.md#131-how-it-behaves), the import parser of [§5.7](../functional/specs/05-transactions.md#57-bulk-import), the reader, the writer, and **every figure a price pass brings back** ([§7.6](../functional/specs/07-investments.md#76-prices)), which arrives as whatever precision a provider states and is narrowed once, in `src/main/prices/PriceQuoteReview.ts`. **The reader refuses a figure that is not an integer at its field's scale exactly as it refuses an unknown key** (D4): a fraction of a cent in the file is a file this application did not write, and it is not silently rounded away.

## 8.3 The four dependencies v1 added

Four libraries, and they are the whole of what v1 added to the five runtime dependencies `package.json` started with. **Every one is pinned to an exact version**, and the tree each drags in is a large part of why the set is closed at four.

| Package | Installed at | What comes with it |
| --- | --- | --- |
| `react-router` | 8.3.0 | `cookie-es`. Version 7 folded the DOM exports into the one package and version 8 keeps them there, so `react-router-dom` is a re-export and is not installed |
| `react-datepicker` | 9.1.0 | `date-fns` and `@floating-ui/react`. `date-fns-tz` is an **optional** peer and stays uninstalled — nothing in this application has a time zone in it |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 6.3.1 and 10.0.0 | `@dnd-kit/accessibility` and `@dnd-kit/utilities`, both the same project's |
| `recharts` | 3.10.1 | `@reduxjs/toolkit`, `react-redux`, `immer`, the d3 modules of `victory-vendor` and a handful of small utilities — much the largest tree of the four |

**Every one of them is wrapped where it meets a screen**, which is what keeps the choice reversible: the date picker behind our own control (D9), each chart behind a component of its own, the drag behind the rule list. **What the rest of the code imports is Spiccioli's component and never the library**, so replacing any of the four is a change in one folder.

**None of them owns anything.** `react-router` is taken in declarative mode only and the ban in [`CLAUDE.md`](../../CLAUDE.md) still stands against its framework mode; recharts' Redux store is internal to recharts and is not a state library this application may reach for — the ledger lives in a context (D2) and nothing else is allowed to hold it.

**D10 was taken on `@dnd-kit/react` and landed on the same project's settled pair.** At 0.5.0 that package was pre-1.0 — the project's newer React package, whose API can still move under a minor bump — so `@dnd-kit/core` with `@dnd-kit/sortable` was taken instead. The keyboard sensor and the accessibility layer that decided D10 are in both, so the fallback cost an API and no capability.

## 8.4 What D14 logs

**The log is one local NDJSON file and nothing sends it anywhere** ([§4.4](04-framework.md#44-the-logger)) — there is no telemetry, no crash reporting service and no console an installed Spiccioli can open, so this file is the whole account of a run that survives it. Nothing in the interface points at it either: the two read-only paths of [§10](../functional/specs/10-settings.md) are the ledger's and its backups'. Every entry is therefore written to be legible on its own, by whoever collects the file after something went wrong.

**Four levels, meaning the same thing everywhere.** `debug` for what happens on a timer or a keystroke — a save, one listing fetched. `info` for the moments of a session — a file opened, created, upgraded, closed, a copy written. `warn` for something refused or recovered — a retried write, an external modification, a file the reader would not take. `error` for something lost — five failed attempts, a copy not written, a render error, a crash.

**Every entry carries a `type`**, and new ones are named `area.event`. The five already written keep the names they have: `config.write`, `blocked-navigation`, `startup-failed`, and the crash handlers' `uncaught-exception` and `unhandled-rejection`.

**One entry describes the run the rest of the file belongs to**, written the moment the logger is initialized ([§1.4](01-architecture.md#14-what-the-main-process-does-at-startup) step 4), from `src/main/config/StartupConfigurationLog.ts`.

| Entry | `type` | Level | Carries |
| --- | --- | --- | --- |
| `Spiccioli started` | `config.startup` | `info` | The version and whether this is a development run; platform, architecture and the Electron, Chrome and Node versions; the locale asked for and the language it resolved to; **where the renderer came from** — `development-server` or `build`, with its location; the runtime paths of [§1.6](01-architecture.md#16-where-the-installations-own-files-live), the log file included and no ledger, since none is open yet; and **the settings that decide how a run behaves** — the three figures of D12, `backupCount`, and the log's own size limit and archive count |

**The file.** The ledger-level entries are written from `src/main/storage`, the byte-level ones from `src/framework/main/storage` — which names no ledger and says *file* throughout (D5).

| Entry | `type` | Level | Carries |
| --- | --- | --- | --- |
| A file opened | `ledger.open` | `info` | The path, the `schemaVersion` read, the size in bytes, the record count per entity, and how long parsing and validating took |
| A file refused | `ledger.refused` | `warn` | The path, the `schemaVersion` found, and **what was not understood** (D4) — the reason and the key, category, role or enum name it was raised on, **never the value**, which on a rejected figure is an amount |
| A file created | `ledger.created` | `info` | The path and the `schemaVersion` written |
| A file upgraded | `ledger.upgraded` | `info` | From which version to which, the name of the pre-upgrade copy, and the counts the dialog showed — rows recategorised, rules repointed or deleted, categories retired. **`error` when the pre-upgrade copy failed and stopped the upgrade**, with what the system said |
| A session closed | `ledger.closed` | `info` | Which of the four doors of [§12](../functional/specs/12-storage.md) it left by, whether anything changed, and so whether a copy was taken |
| A save | `storage.save` | `debug` | The bytes written and how long the write and the rename took |
| A save that failed | `storage.save` | `warn` | Which attempt of the five, what the system said, and how long until the next. **`info` when a later attempt or the blocking *Retry* succeeds, `error` after the fifth** |
| An external modification | `storage.external` | `warn` | The path, the hash that was recorded against the hash found (D13), the name of the copy the displaced version went to, and whether that copy was written |
| A copy written | `storage.backup` | `info` | Which of the three kinds — close, external, pre-upgrade — its name, how many copies the folder now holds and which was rotated out. **`error` with what the system said when it could not be written** |

**The renderer's way into the log**, over IPC, in `src/main/ipc/DiagnosticsIpc.ts`. It is what [§1.3](01-architecture.md#13-layers-inside-the-renderer) rests on: a render error written to the renderer console alone would go to a place an installed Spiccioli cannot open and that outlives nothing.

| Entry | `type` | Level | Carries |
| --- | --- | --- | --- |
| A render error | `renderer.error` | `error` | The message, the stack and the component stack, **each truncated at a length `AppConfig` fixes**. The renderer chooses neither the message nor the level, and nothing it sends can grow a line without limit |

**The price pass**, written where the adapter is called and not inside it.

| Entry | `type` | Level | Carries |
| --- | --- | --- | --- |
| A pass | `prices.pass` | `info` | At the start, how many listings it will ask for and how many of them want a span rather than the latest quote; at the end, the counts — quoted, no quote, refused, could not be fetched, and how many days in all |
| One listing | `prices.listing` | `debug` | The `ticker`, the `exchange`, and what came back: how many days it carried, how many were dropped and the newest day of them, or which of the four refusals of [§7.6](../functional/specs/07-investments.md#76-prices) it fell to, or the transport failure |
| What the confirmation wrote | `prices.written` | `info` | How many Price records were written and the span they cover, oldest and newest — **the span rather than the days**, a confirmed history being thousands of them. **A cancelled pass writes it with a count of nothing**: [§7.6](../functional/specs/07-investments.md#76-prices) leaves no trace in *the ledger*, and the log still says the pass happened and ended |

**What never reaches the file.** Not an amount, not a description, not an institution, account, security or contract name, not an ISIN, not a payslip figure, not a rule's pattern. **The price pass is the one exception and it is exactly what already left the machine** — a `ticker` and an `exchange` (D11), with the quote that came back, which is public market data and says nothing about how much is held. **Paths are not redacted**: the ledger's is already in the recent-file list in plain text, and no storage failure can be diagnosed without knowing which file it was.

## 8.5 What is fixed, and is not up for decision

Restated here so that a change does not reopen it: everything in [`CLAUDE.md`](../../CLAUDE.md), and from the analysis — EUR only with no currency anywhere, English only through the translation layer, one dark theme, derived data never stored except the assigned category, twenty-seven seeded categories that no runtime editor touches, no undo, checks that report and never prevent, and the whole of [§15](../functional/specs/15-out-of-scope.md).

## 8.6 The risks these decisions carry

Live, and named here so that a change in the area one governs meets it first. The risks the plan carried about *building* the application went with the plan.

- **The price provider is an unsanctioned endpoint and can go away without notice** (D11). **The risk is contained rather than removed**: [§7.6](../functional/specs/07-investments.md#76-prices) makes a provider failure a line in the review panel and never a blocked screen, the application is fully usable with every price typed by hand, and the adapter is one file behind one interface. What it costs when it breaks is **a new version**, which is what [§7.6](../functional/specs/07-investments.md#76-prices) already says a change of provider is. The candidates to re-run are in [the companion page](08-decisions-why.md#why-the-provider-is-yahoos-chart-endpoint).
- **The representation of D3 has to hold at every boundary.** It reaches every entity, so what is left is the five places a binary64 could put a fraction of a cent into the file — the amount field, the import parser, the reader, the writer, and **the price a fetch brings back** — and nothing downstream would notice it. The reader refusing a non-integer is what turns that from a convention into a check, and it is the only one of the five that also catches a file somebody else wrote.
- **The log is the one place the redaction rule can be broken quietly.** `AppLogFields` takes anything, so nothing in the types stops an amount or a description from being passed to `appLogger`, and a log line is not read until something has already gone wrong. What stands against it is the inventory of D14 being per entry rather than per call site, and a review that checks the fields against it. The exposure is bounded — a file on disk that nothing sends anywhere — which is why this stays a rule rather than a mechanism.

---

[← §7 Testing](07-testing.md) · [why they went this way →](08-decisions-why.md)
