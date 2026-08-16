# §8 — Implementation plan

*[Index](README.md) · [← §7 Testing](07-testing.md)*

The route from the scaffolding that exists today to the application [`docs/functional/`](../functional/README.md) specifies. **This is the one page in this set that describes work not yet done**, and it is kept current: a phase that lands is marked done here in the same commit, and the pages it changed are updated with it.

It carries three things: the **decisions still to be taken** ([§8.2](#82-decisions-still-to-be-taken)), the **shape the code is heading towards** ([§8.4](#84-the-shape-of-the-code)), and the **twelve phases** the work is cut into ([§8.5](#85-the-phases)). Where a section cannot be written until a decision is taken it says **to be completed** and names the decision.

---

## 8.1 How the phases are ordered

Three constraints fix the order, and everything else follows from them.

- **Nothing can be built before there is a file to put it in.** [§12](../functional/specs/12-storage.md) is the foundation: the domain model, the file, autosave, backups and the launch screen come first because every screen writes through them.
- **The screens are ordered by what they depend on, not by what is most wanted.** Accounts is the spine ([§4](../functional/specs/04-accounts.md)), Transactions hangs off it, Categories reads Transactions, Investments and Salaries stand on their own, Checks reads everything, and Portfolio reads everything including Checks. Portfolio is the home screen and is built last.
- **Every formula in [§11](../functional/specs/11-calculations.md) is pure and is written test-first**, in the phase of the screen that first shows it, before that screen is built. It is the highest-risk correctness area in the application and the cheapest to test in isolation.

Each phase leaves the application **running, linted, typechecked and tested**. A phase is not a branch and not a release; it is a unit of review.

## 8.2 Decisions still to be taken

Each of these has to be settled before the phase that names it can start. **None of them is settled here** — this table is the agenda.

| # | Decision | Blocks | Options | Leaning |
| --- | --- | --- | --- | --- |
| D1 | **The ledger file format**, and its extension ([§12](../functional/specs/12-storage.md)) | Phase 1, and the file-format document | Electron's bundled `node:sqlite`, no dependency; or JSON, one document | **JSON.** [§12](../functional/specs/12-storage.md) wants a whole file written atomically by temp-file-and-rename, a script that can write it, and external-modification detection over the whole file — all of which a single document gives directly, while SQLite gives a live connection that has to be closed and copied around each of them. A decade of history is a few thousand transactions: single-digit megabytes, rewritten on a debounce. `node:sqlite` remains the option to beat and the decision has to be argued, not assumed |
| D2 | **Which process holds the ledger** | Phase 1 | Renderer holds the model, main writes bytes; or main holds it and the renderer queries | **Renderer holds it.** Every figure in [§11](../functional/specs/11-calculations.md) is derived on read, so the model has to be in memory beside the screens. The main process owns the file and nothing else |
| D3 | **How money, quantities and rates are represented** | Phase 1, every entity | Integer minor units; a decimal helper; binary64 | **Integer minor units** — cents for amounts, 1/10 000 for quantities, prices and rates. [§11](../functional/specs/11-calculations.md) rounds only at display and names three mid-calculation roundings; binary64 cannot honour that. [§11.8](../functional/specs/11-calculations.md#118-annualised-return) is the one place binary64 is **specified** and stays so |
| D4 | **The schema version scheme**, and what "not understood" means concretely ([§12](../functional/specs/12-storage.md)) | Phase 1 | Integer; semantic version | An integer, incremented per shape change. The refusal has to catch an unknown field, category or role, so the reader validates exhaustively rather than ignoring extras |
| D5 | **Where the new storage layer lives** — `src/framework` or `src/main` | Phase 1 | Framework, and therefore back into SPOT ([§4.1](04-framework.md#41-what-it-is)); or Spiccioli only | Atomic whole-file autosave, retry, rotation-by-count and external-modification detection are application-agnostic and belong in the framework by [§4.5](04-framework.md#45-adding-to-it). The cost is carrying them into SPOT. Decide once, for the whole layer |
| D6 | **What becomes of the framework's unused storage modules** ([§4.3](04-framework.md#43-what-is-present-and-not-used-yet)) | Phase 1 | Delete; keep | [§4.3](04-framework.md#43-what-is-present-and-not-used-yet) defers this to the moment the replacing section is written, which is Phase 1 |
| D7 | **Routing between the eight screens** | Phase 2 | `react-router`; hand-rolled screen state | **Hand-rolled.** [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open) remembers no screen, no tab, no filter and no selection between files or sessions, and no URL is ever shared — which leaves a router with nothing to do that a context does not |
| D8 | **How the four charts are drawn** ([§3.1](../functional/specs/03-portfolio.md#31-behaviour), [§8.1](../functional/specs/08-salaries.md#81-payslips)) | Phase 11, Phase 9 | A charting dependency; hand-rolled SVG | Undecided, and the one dependency question worth real argument. Four charts, one of them per-point dashed with a legend explaining why ([§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time)); a library makes three of them trivial and the fourth a fight |
| D9 | **The date picker** | Phase 2 | Native `<input type="date">`; custom | **Custom.** A native picker renders in the browser's locale, and [§10](../functional/specs/10-settings.md) requires `dateFormat` to decide it. It also has to offer no day after today ([§13](../functional/specs/13-validation.md)) |
| D10 | **How rules are reordered** ([§6.2](../functional/specs/06-categories.md#62-rules)) | Phase 6 | HTML5 drag events; a DnD dependency | HTML5 drag events over a list of eleven-to-fifty rows. Note that [§15](../functional/specs/15-out-of-scope.md) declines keyboard-shortcut work, so drag has no keyboard equivalent in v1 — see the risk in [§8.7](#87-risks) |
| D11 | **The price provider** ([§7.6](../functional/specs/07-investments.md#76-prices)) | Phase 8 | — | **Open, and the riskiest item here.** The spec requires one built-in provider, named on screen, with **no endpoint, key or credential to configure**, taking an ISIN or a ticker and returning a quote, its date and **its currency**. A provider that cannot state the currency does not qualify. A compiled-in API key in a public repository is not a way to meet "nothing to configure". If no provider qualifies, that is a specification question to raise, not a thing to work around |
| D12 | **The autosave debounce, the retry spacing and the write timeouts** | Phase 1 | — | Values for `AppConfig`, chosen with the storage layer. [§12](../functional/specs/12-storage.md) fixes five attempts "spaced a few seconds apart" and nothing more |
| D13 | **How external modification is detected** | Phase 1 | mtime and size; content hash | mtime and size is what a save can compare cheaply before every write; a hash is certain and costs a read. Decide with D1 |

## 8.3 What is already fixed, and is not up for decision

Restated here so a phase does not reopen it: everything in [`CLAUDE.md`](../../CLAUDE.md), and from the analysis — EUR only with no currency anywhere, English only through the translation layer, one dark theme, derived data never stored except the assigned category, twenty-seven seeded categories that no runtime editor touches, no undo, checks that report and never prevent, and the whole of [§15](../functional/specs/15-out-of-scope.md).

## 8.4 The shape of the code

Where the new folders go. `src/framework` keeps the rule of [§4](04-framework.md) throughout: nothing below imports upwards.

| Path | Holds |
| --- | --- |
| `src/types/` | The eleven stored entities and the derived holding of [§2](../functional/specs/02-domain-model.md), the ledger document, the preferences |
| `src/logic/` | Everything pure and testable with no React in it: the ledger reader and writer, the categorisation pass, the [§11](../functional/specs/11-calculations.md) calculations, the [§11.6](../functional/specs/11-calculations.md#116-derived-matching) matchers, the fourteen checks, the import parser, and the formatters that turn a stored figure into what [§10](../functional/specs/10-settings.md) says it looks like |
| `src/contexts/` | The ledger in memory, the preferences, the save state, the check results — the four things every screen reads |
| `src/components/common/` | The kit of [§8.5](#85-the-phases) phase 2: the amount field, the date picker, the table, the row menu, the confirm dialog, the filter bar, the empty state |
| `src/components/<screen>/` | One folder per sidebar item, plus `launch/` and `import/` |
| `src/main/storage/` | The file: read, write, atomic replace, retry, backups, external-modification detection — or `src/framework/main/storage/`, per D5 |
| `src/main/menu/` | The File menu and the About item of [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open) |

**Every user-facing string added anywhere goes into `src/i18n/lang/en.ts`** ([§5](05-text-and-languages.md)), and every tunable value into `src/config/AppConfig.ts`. Neither is restated in the phases below; both apply to all of them.

## 8.5 The phases

| # | Phase | Specification | Depends on |
| --- | --- | --- | --- |
| 1 | [The file](#phase-1--the-file) | [§2](../functional/specs/02-domain-model.md), [§12](../functional/specs/12-storage.md) | D1 – D6, D12, D13 |
| 2 | [The shell and the kit](#phase-2--the-shell-and-the-kit) | [§10](../functional/specs/10-settings.md), [§13.1](../functional/specs/13-validation.md#131-how-it-behaves), [§14](../functional/specs/14-empty-and-error-states.md) | 1, D7, D9 |
| 3 | [Accounts and institutions](#phase-3--accounts-and-institutions) | [§4](../functional/specs/04-accounts.md) | 2 |
| 4 | [Transactions](#phase-4--transactions) | [§5.1](../functional/specs/05-transactions.md#51-columns) – [§5.6](../functional/specs/05-transactions.md#56-selecting-and-deleting-in-bulk) | 3 |
| 5 | [Bulk import](#phase-5--bulk-import) | [§5.7](../functional/specs/05-transactions.md#57-bulk-import) | 4 |
| 6 | [Categories](#phase-6--categories) | [§6](../functional/specs/06-categories.md) | 4, D10 |
| 7 | [Investments](#phase-7--investments) | [§7.1](../functional/specs/07-investments.md#71-holdings) – [§7.5](../functional/specs/07-investments.md#75-recording-a-trade-and-where-securities-come-from), [§11.1](../functional/specs/11-calculations.md#111-weighted-average-cost) – [§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation), [§11.8](../functional/specs/11-calculations.md#118-annualised-return) | 3 |
| 8 | [Update prices](#phase-8--update-prices) | [§7.6](../functional/specs/07-investments.md#76-prices) | 7, D11 |
| 9 | [Salaries](#phase-9--salaries) | [§8](../functional/specs/08-salaries.md), [§11.7](../functional/specs/11-calculations.md#117-salary-figures) | 2, D8 |
| 10 | [Matching and checks](#phase-10--matching-and-checks) | [§9](../functional/specs/09-checks.md), [§11.6](../functional/specs/11-calculations.md#116-derived-matching) | 4, 7, 9 |
| 11 | [Portfolio](#phase-11--portfolio) | [§3](../functional/specs/03-portfolio.md), [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth), [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) | 10, D8 |
| 12 | [Release readiness](#phase-12--release-readiness) | [§12](../functional/specs/12-storage.md) | 11 |

### Phase 1 — The file

The domain model and everything [§12](../functional/specs/12-storage.md) asks of the file. No screens beyond the launch one.

- The eleven stored entities of [§2](../functional/specs/02-domain-model.md) as types, with the representation of D3. `id` generation, and `insertionSeq` monotonic per entity and never reused.
- The ledger document, its schema version, its reader and its writer. **A file at a later version, or at a known version carrying an unrecognised category, role or field, is refused with a statement of what was not understood.** There is no read-only mode.
- **The twenty-seven categories of [§6.3](../functional/specs/06-categories.md#63-category-list) seeded**, with their types, roles, order and `receiptTracked`, into every new file.
- Autosave: debounced, written to a temporary file in the same directory and renamed. **Five retries, spaced**, with the save state and the on-screen line while they run and the blocking *Retry* after the fifth.
- External-modification detection before every write, the displaced version copied into the backup folder, and the line that says so in [§12](../functional/specs/12-storage.md)'s own words with `backupCount` interpolated.
- The backup folder beside the ledger, named for it; the three copy names; **rotation as copies arrive, oldest out first**; one copy per session on close, only if something changed, through all four doors.
- Preferences and the recent-file list through `JsonConfigStore`, in the paths of [§1.6](01-architecture.md#16-where-the-installations-own-files-live).
- The launch screen ([§12.1](../functional/specs/12-storage.md#121-the-launch-screen)): recent locations, *Open…*, *New file…* which writes the seeded file at the moment the location is chosen, struck-through entries for files that moved. `PlaceholderPage` goes away here.
- The File menu, *Open Recent*, the About item, and the window title carrying the file's name.
- **The upgrade path is built and has nothing to upgrade yet**: version comparison, the pre-upgrade backup that stops the upgrade when it fails, and the dialog of [§12.1](../functional/specs/12-storage.md#121-the-launch-screen). No migration step is registered until there is a second schema version.

*Done when* a file can be created, closed, reopened, backed up, rotated, displaced by an external write and refused when unreadable — and the storage layer's tests say so without a screen.

**The file-format document is a deliverable of this phase** and becomes `docs/technical/09-file-format.md`: [§12](../functional/specs/12-storage.md) requires the format documented well enough for the one-off migration script to write it. **To be completed — depends on D1.**

### Phase 2 — The shell and the kit

Everything every later screen is made of.

- The sidebar: eight screens, the failing-check badge, the save state. Routing per D7. **An opened file lands on Portfolio with no filter set anywhere.**
- The kit: the amount field of [§13.1](../functional/specs/13-validation.md#131-how-it-behaves) — one control, at most two decimals, the decimal character `decimalSeparator` names and no thousands separator typeable, with the four-decimal variant for prices and quantities; the date picker of D9; the table with its footer; the row menu; the confirm dialog; the inline-edit cell that keeps a refused value out and never leaves a row half-changed; the filter bar; the empty state; the chip.
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
- **Rules tab**: the draft session that writes nothing until *Apply changes*; the four-figure consequence summary; the write of rules and categories in one step; the unsaved-draft prompt with **discard and stay and no apply**; the *Applies to* column counting first-match `automatic` rows only, dimmed while a draft is pending; reordering per D10.
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
- The two charts, per D8.

### Phase 10 — Matching and checks

- `src/logic`: **the five matchers of [§11.6](../functional/specs/11-calculations.md#116-derived-matching)**, each greedy, each stating its walk order, each claiming the nearest-dated unclaimed counterpart, each comparing signed amounts on cent-rounded totals, and **each side bucketed by amount** — which [§9](../functional/specs/09-checks.md) fixes as the intended implementation rather than a later optimisation.
- **The fourteen checks**, in the order of [§9](../functional/specs/09-checks.md), each naming at most five records with the whole count and the ordering of the screen those records live on.
- The runner: **at startup and after every change, debounced**, a run in flight superseded by the next, and no manual re-run.
- The Checks screen, the sidebar badge counting failing checks, and the *Matched* column on Transactions, Purchases and Sales that this phase finally fills in.

### Phase 11 — Portfolio

The home screen, and the last one, because every figure on it is somebody else's output.

- `src/logic`: the balances and the four-way decomposition of [§11.4](../functional/specs/11-calculations.md#114-balances-and-net-worth); the pension fund half of [§11.3](../functional/specs/11-calculations.md#113-hypothetical-liquidation) with its two clamps; the monthly series of [§11.5](../functional/specs/11-calculations.md#115-net-worth-over-time) with its per-point fallback to cost.
- The failing-check banner; the headline and the four lines that add to it, each with its own note; the *gains and costs* card with its five lifetime figures, its total and the count of the sales it left out; the breakdown by type with its pie and its negative and zero rows; the net worth chart with its dashed points and its legend; the breakdown by account totalling to the headline.
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
- **Rule reordering has no keyboard path.** [§6.2](../functional/specs/06-categories.md#62-rules) reorders by drag, [§15](../functional/specs/15-out-of-scope.md) declines keyboard-shortcut work, and `CLAUDE.md` requires every control to be reachable and activatable by keyboard. The three are reconcilable — a drag handle can be a real button — but the reconciliation has to be designed rather than assumed.
- **D3 reaches every entity.** Choosing the money representation late means rewriting the model. It is in Phase 1 for that reason.
- **The [§11.6](../functional/specs/11-calculations.md#116-derived-matching) matchers are the subtlest code in the application** — five greedy pairings whose determinism the specification is explicit about. They are where a test suite earns its keep, and where a shortcut is most expensive.

## 8.8 Sections to be completed

| Where | Waiting on |
| --- | --- |
| The storage design, and `docs/technical/09-file-format.md` | D1 |
| [Phase 8 — Update prices](#phase-8--update-prices) | D11 |
| The chart approach in phases 9 and 11 | D8 |

---

[← §7 Testing](07-testing.md)
