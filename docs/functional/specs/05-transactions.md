# §5 — Transactions

*[Index](../README.md) · [why it is this way](../why/05-transactions.md) · [mockups for this section](../mockups/05-transactions.html)*

The screen with the most hours on it. No tabs.

> **Mockup —** [Transactions list](../mockups/05-transactions.html#list)

---

## 5.1 Columns

- **Account** names the account, not the institution — *Fineco · Conto Corrente*, never *Fineco*. The same rule holds everywhere an account is shown.
- **Category** chip is violet when `categorySource = automatic` and a rule matched, neutral when `manual`, red when no category was assigned. Violet denotes provenance, not correctness.
- **Matched** is derived and read-only, and it names the counterpart for **every** kind of pairing [§11.6](11-calculations.md#116-derived-matching) makes: the counterpart account for a paired internal transfer, the security for a trade-matched securities transaction, and the **payslip** for a salary transaction or a pension-fund credit paired with one — its month and its label, *December 2025* or *December 2025 · 13th*. An em dash otherwise.
- **Notes** is free text the user owns. **The application never writes to it.**
- **Receipt** is a picker with three values, chosen directly. The stored values are `pending`, `checked` and `na` ([§2](02-domain-model.md)); **the third is written *N/A* everywhere it is shown to the user** — in this picker, on the add-transaction form and in the checks that read it — and the lower-case `na` appears in this document and in the file, never on a screen. It is not a cycle and there is no order to work through ([§6.3](06-categories.md#63-category-list)).
- The footer sums the filtered rows, across all pages.

## 5.2 Ordering and paging

- Always `date ASC, insertionSeq ASC, id ASC`. Columns are not sortable and the order is not configurable.
- **50 rows per page.** This is the only paginated table in the application; every other table is shown in full.
- **The screen opens on the last page**, so the most recent rows are in view. The pager is how you go back.
- **Changing a filter lands on the last page of what it now matches**, on the same rule and for the same reason. A page number carried over from the previous filter would point at a different part of a different list — page 7 of nine hundred rows is somewhere in 2019, and page 7 of eighty is the end — so the position is recomputed rather than kept. **This is the only thing a filter change does to the view**, the ordering and everything else being fixed ([§5.6](#56-selecting-and-deleting-in-bulk) is what it does to the selection).
- **However the screen is reached, it is the same screen.** Arriving from a report cell ([§6.1](06-categories.md#61-report)) or from a finished import ([§5.7](#57-bulk-import)) sets the filters and changes nothing else: the last page of what those filters match, the same ordering, the same everything.

## 5.3 Filters

Account · period · category · **set by** · amount range · receipt state · free-text search on description. **The account filter lists cash accounts only** ([§2](02-domain-model.md)). Combined with AND.

**Every filter in the application takes one value or none.** An account filter selects one account or *All*, a category filter one category, and there is no multiple selection anywhere — not here, not on the report ([§6.1](06-categories.md#61-report)) and not on Purchases and Sales ([§7.2](07-investments.md#72-purchases)). This is what lets one screen hand its filters to another and know they fit ([§5.2](#52-ordering-and-paging)).

**Each of the three that could be read two ways is fixed here, and the rule holds wherever the same filter appears** — the report's account filter, the period on Purchases and Sales ([§6.1](06-categories.md#61-report), [§7.2](07-investments.md#72-purchases)):

- **Period is two date pickers, *from* and *to*, and both ends are inclusive.** Either may be left empty, which leaves that end open, and both empty is no period filter at all. It is the same date picker used everywhere else ([§10](10-settings.md)).
- **The amount range is on the signed amount, and both ends are inclusive.** −100 to −10 selects payments between ten and a hundred euros; 0 to 0 selects the zero-amount rows ([§13](13-validation.md)); −10 to 10 selects the small ones in both directions.
- **The search is case- and accent-insensitive**, on the description only, and matches anywhere in it. It is the same comparison a rule makes ([§2](02-domain-model.md)).

Filters affect the footer totals and the page count. **No filter is applied by default** — opened from the sidebar the screen shows the whole history, and the period filter in the mockup is one the user set. The two ways in that arrive with filters already set say so as they hand over ([§5.2](#52-ordering-and-paging)): a report cell and a finished import both set them where the user would have, and both leave every control free to be changed or cleared. The category filter lists the twenty-seven categories **alphabetically**, with an *Uncategorised* entry above them ([§6.3](06-categories.md#63-category-list)).

**Set by** filters on `categorySource`: *anything*, *a rule*, *by hand*.

## 5.4 Editing

- **Every cell is editable in place** — date, account, description, amount, category, receipt state, notes. Click to edit. The account picker offers only cash accounts; a transaction can never be moved onto a brokerage one.
- Setting a category by hand sets `categorySource = manual`, which protects it from every automatic re-categorisation.
- **The picker has no way to choose nothing.** It offers *Automatic* at the top and the twenty-seven categories **alphabetically** below it ([§6.3](06-categories.md#63-category-list)), and no clearing entry ([§13](13-validation.md)). The only empty category in the file is therefore one no rule matched, which is exactly what check 2 is counting.
- **This is reversible.** The category picker's special entry — *Automatic (let rules decide)* — sets `categorySource` back to `automatic` and immediately re-applies the rule list to that transaction, leaving the category empty if no rule matches. There is no state a hand-edit can trap a row in.
- **Editing the description of an `automatic` row re-runs the rule list over that row** as the edit is committed ([§2](02-domain-model.md)). A `manual` row keeps its category whatever its description becomes.
- Row menu: **Duplicate**, **Delete**. Delete asks for confirmation — there is no undo.
- **Duplicate copies the record and opens the copy for editing, last among the rows sharing its date.** It carries over account, date, description, amount, category and notes; it takes a new `id` and a new `insertionSeq`, and that sequence is the highest in the file, so the ordering of [§5.2](#52-ordering-and-paging) puts it after every other row of that date — immediately below the original when the original is the newest of them, which is the usual case, and a few rows further down when it is not. Change the date and it moves to where that date belongs, on the next redraw. Two fields do not come across as-is. `receiptState` resets to `na` ([§5.5](#55-add-transaction), [§6.3](06-categories.md#63-category-list)). `categorySource` is preserved: a copy of a hand-set row is itself hand-set and keeps the category, a copy of an automatic row is automatic and is re-derived from the description it inherited.
- **“Duplicate” here is not the “duplicate” of [§5.7](#57-bulk-import).** A row created by this action is not flagged by that detection — it is only consulted when rows are pasted.
- **There is no “apply rules” action on this screen.** The one place the list is applied is the Rules tab, and it is applied there as part of changing it ([§6.2](06-categories.md#62-rules)).

## 5.5 Add transaction

> **Mockup —** [Add transaction](../mockups/05-transactions.html#add-transaction)

- **Seven fields, in this order: account, date, description, amount, category, receipt, notes** — every field of a transaction the user fills in. The three stored fields that are not on it are not asked for: `categorySource` follows from the category picker, *Automatic* meaning `automatic` and any category meaning `manual` ([§5.4](#54-editing)), and `id` and `insertionSeq` are the application's ([§2](02-domain-model.md)). Description is required and is the only thing a rule will match on ([§13](13-validation.md)); notes are optional and the application never writes to them ([§5.1](#51-columns)).
- **Account** starts empty and lists cash accounts only — closed ones among them, marked and last ([§4.3](04-accounts.md#43-creating-and-editing)). **No picker in the application remembers what was chosen last.**
- **Date** is a date picker defaulting to today and **offering no day after it** ([§13](13-validation.md)); **amount** is a validated numeric field, signed, negative being money out. **Neither holds text that has to be interpreted.** The date picker shows dates in the format `dateFormat` names and returns a day, not a string; the amount field accepts digits and **the one decimal character `decimalSeparator` names**, and nothing else — the other character is not typeable and a thousands separator is not typeable at all ([§10](10-settings.md), [§13](13-validation.md)). A preference decides which key means *decimal*; it never decides what an entered figure meant.
- **Category** defaults to *Automatic*, so a manually added row is categorised by the same rules as an imported one.
- **Receipt** defaults to *N/A*, and this form is **the one place a row can be given a state before it exists**: the picker offers all three values and whatever it holds on save is what the row is created with. Every other way a row arrives — an import, a duplicate — creates it `na` and leaves the state to be moved afterwards ([§5.7](#57-bulk-import), [§6.3](06-categories.md#63-category-list)). Nothing about the category the row ends up with changes it, on this form as everywhere else.
- **Save and add another** keeps the dialog open with account and date retained and the other fields cleared.

## 5.6 Selecting and deleting in bulk

- A **checkbox column** leads every row. Click one, shift-click another and the range between them is selected; the header checkbox selects **everything the filters currently match**, across pages, not just the page in view.
- The only bulk action is **delete**. It confirms once, stating the count and the total amount about to disappear — *Delete 214 transactions totalling − € 8.412,90?* — because there is no undo ([§12](12-storage.md)).
- **There is no bulk edit.**
- **Selection survives paging, and nothing else.** Turning the page keeps every tick, so a selection may span pages and the count in the header and the footer is the whole of it, not the part in view. Coming back to a page shows the ticks still there.
- **Every other action clears it**: changing a filter, editing any cell, a row-menu *Duplicate* or *Delete*, leaving the screen, and the bulk delete itself.

## 5.7 Bulk import

One screen. One job: get raw rows in without duplicating anything. It is reached from the *Bulk import* button on the Transactions screen, and the sidebar stays on Transactions.

> **Mockup —** [Bulk import](../mockups/05-transactions.html#bulk-import)

### One screen

- **The paste box, the three format controls and the consequences of the paste are on screen together.** Row count, preview, duplicate flags and the count on the *Import* button all update live as text is pasted or edited, or as a control is changed. There is no *Continue*, no review step and no way back: a mis-shaped paste is corrected where it was made.
- The **account is chosen once** for the whole paste, not per row. It **starts empty and is the first thing to pick** ([§5.5](#55-add-transaction)), and lists cash accounts only — a brokerage account holds no transactions to import.
- **Fixed column order: date · description · amount**, one row per line, **columns separated by tabs**.
- A line is split on tabs and each field trimmed; **a line that is empty or all whitespace is skipped silently**, not reported as unreadable.
- **Columns after the third are ignored**, not treated as an error. Only *fewer* than three columns makes a row unreadable.
- A single signed amount column; debit/credit pairs are not supported. Bank-specific import profiles are future work.

### The three format controls

- **Nothing about a paste is inferred.** The screen carries three controls — **date format**, **decimal separator** and **thousands separator** — and the rows are read exactly as those controls say they should be. There is no detection, no chip, no evidence weighed across rows and no fallback assumption. A row that does not fit what the controls say is a row that cannot be read.
- **Each control offers the same values as the preference of the same name** ([§10](10-settings.md)) and **opens at the value that preference currently holds**: `DD/MM/YYYY` · `MM/DD/YYYY` · `YYYY-MM-DD` for the date, `,` · `.` for the decimal separator, `.` · `,` · space · **none** for the thousands separator.
- **Changing one re-parses every row immediately** — the preview, the marks, the duplicate flags and the count on the *Import* button with it. This is the control to reach for when the preview looks wrong.
- **The controls belong to the paste, not to the preferences.** Changing one here changes nothing on Settings, and it is remembered nowhere: the next import opens at the preferences again, like every other picker in the application ([§5.5](#55-add-transaction)).
- **Decimal and thousands must differ**, the same rule the preferences carry ([§13](13-validation.md)); choosing the decimal separator's character as the thousands one is refused in place and the previous value stays in force. **None** never collides.

### Dates

- **The date control names the order of the three parts and nothing else.** `DD/MM/YYYY`, `MM/DD/YYYY` and `YYYY-MM-DD` are day-month-year, month-day-year and year-month-day; the last is what an ISO date is, so `2026-07-11` needs no entry of its own.
- **The separator between the parts may be `/`, `-` or `.`, whichever the control's label happens to print**, and carries no meaning: all three are accepted under every one of the three orders, and a paste may mix rows that use different ones. The control selects the order and nothing else.
- **The year is always four digits.** A two-digit year cannot be read and the row is marked like any other unreadable one.
- **A field that is not a real date under the chosen order cannot be read.** The three parts are taken in the positions the control names and each must be a real one: `31/02/2026` is marked rather than rolled into March, **a month outside 1 – 12 is marked** rather than carried into the next year, and so is a day of 0. Nothing is ever rolled over into a neighbouring month or year.
- **A date later than today cannot be read either** ([§13](13-validation.md)); the row is marked with that reason like any other.
- Anything else in the date column — a month name, a weekday, a time appended after the date — **cannot be read** ([§15](15-out-of-scope.md)).

### Amounts

- **The two separator controls say what the digits mean.** With the decimal separator at `,` and the thousands separator at `.`, `1.234,56` and `1234,56` are both € 1.234,56, and `1,234.56` cannot be read at all. Flip the two controls and the readings swap.
- **Zero, one or two decimals are all read**: `1234`, `1234,5` and `1234,56` are amounts. **More than two cannot be read**, exactly as the amount field refuses a third ([§13](13-validation.md)).
- **The decimal separator may appear at most once.** A field carrying two of them cannot be read, and that holds whichever character the control is set to — with the decimal at `.`, `1.234.56` is an unreadable row and not one thousand two hundred and thirty-four euros fifty-six. The character that groups is the thousands one and it is a different key; a field is never asked to work out which of two identical characters was meant as which.
- **Thousands separators are optional, and where they appear they must group the integer part in threes.** `1.234.567,89` reads; `1.2345` does not. **With the control at none, a thousands separator anywhere in the field makes the row unreadable** — which is what catches a control left on the wrong setting instead of quietly reading the number as something else.
- **The sign is a leading `-` for money out, and a leading `+` or nothing at all for money in.** Trailing signs, parentheses and `D`/`C` markers are not read ([§15](15-out-of-scope.md)).
- **A `€` or `EUR` marker on the amount is stripped before the separators are read**, leading or trailing, with or without a space between it and the digits: `€ -54,80`, `-54,80 €` and `-54,80 EUR` are the same amount as `-54,80`. **Those two spellings and no others.** This is not configurable and there is no fourth control: there is no currency setting anywhere in the application ([§10](10-settings.md)), and `€` is simply what the amounts in this file are ([§1](01-premise-and-constraints.md)).

### Rows that cannot be read

- A row with fewer than three columns, whose date does not parse **under the chosen date format**, whose date is **in the future**, whose amount does not parse **under the chosen separators**, or **whose description is empty** once trimmed, appears in the preview **marked with the reason, and cannot be ticked**. It is excluded from the count on the *Import* button and from the import. These are the transaction rules of [§13](13-validation.md) and nothing more — an import cannot write a row the form would have refused.
- **An amount of `0,00` reads fine and is imported.** It is a legal amount ([§13](13-validation.md)), and a row is unreadable only when the amount cannot be understood — not when it is understood to be nothing.
- **A column of rows the preview says are in the future is the paste telling you the date control is wrong.** `07/11/2026` read as `MM/DD/YYYY` is next November; set the control to `DD/MM/YYYY` and the column reads.
- **An unreadable row never blocks the rows around it.** Import what is good, fix the rest, paste again — the duplicate detection below is what makes re-pasting safe.
- *Import* is disabled while no account is chosen or no row is selected, and by nothing else ([§13](13-validation.md)).

### Duplicates

- **Every readable row arrives ticked.** A flagged duplicate is the one thing that arrives unticked, and an unreadable row cannot be ticked at all ([§13](13-validation.md)) — so a paste with nothing wrong in it needs no ticking before *Import*, and the ticks that are missing are the two the screen has just explained.
- Exact match on **account + date + amount + normalised description** against transactions already in the file. Normalisation: trim, collapse whitespace, case-fold.
- A match is flagged and **unselected**, not removed. The user may re-select it.
- Rows within the paste are **never** compared with each other. Two identical rows in one paste that also match a single existing transaction are therefore **both** unselected.

### After import

**Rows are written in the order they were pasted**, taking consecutive `insertionSeq` values in that order ([§2](02-domain-model.md)). A paste is usually in date order already, but where it is not — two rows of one day the bank listed the other way round — the file keeps the order the export had, and that is the order the list shows them in ([§5.2](#52-ordering-and-paging)). Rows the user left unticked take no sequence at all; the ones imported are consecutive among themselves.

Rows are inserted with `categorySource = automatic`, which means the rule list applies to them as they are written and they arrive categorised wherever a rule matches ([§2](02-domain-model.md)), and with `receiptState = na`. **The paste has no receipt column and the screen has no picker for one** ([§5.5](#55-add-transaction), [§6.3](06-categories.md#63-category-list)). Check 13 therefore fails straight after an import, which is that check working ([§9](09-checks.md)).

**No categorisation is previewed on this screen.** The user lands on Transactions filtered to the account imported into and to the date range of the rows imported — the ordinary screen on its last page, with two filters already set ([§5.2](#52-ordering-and-paging)) — where a wrong category can be fixed in place with the full filter set available.

That filter is an ordinary account-and-period filter, reachable by hand like any other. **An import leaves no trace on the transactions it created**, and a row that came from a paste is indistinguishable from one typed by hand.

---

[← §4 Accounts](04-accounts.md) · [§6 Categories →](06-categories.md)
