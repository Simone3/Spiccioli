# §5 — Transactions

*[Index](../README.md) · [mockups for this section](../mockups/05-transactions.html)*

The screen with the most hours on it. No tabs.

> **Mockup —** [Transactions list](../mockups/05-transactions.html#list)

---

## 5.1 Columns

- **Account** names the account, not the institution — *Fineco · Conto Corrente*, never *Fineco*.
  One institution routinely holds several accounts, and which one a row belongs to is what the
  matching of [§11.6](11-calculations.md#116-derived-matching) turns on. The same rule holds
  everywhere an account is shown.
- **Category** chip is violet when `categorySource = automatic` and a rule matched, neutral when
  `manual`, red when no category was assigned. Violet denotes provenance, not correctness —
  deliberately not green.
- **Matched** is derived and read-only: the counterpart account for a paired internal transfer, the
  security for a trade-matched securities transaction, an em dash otherwise
  ([§11.6](11-calculations.md#116-derived-matching)).
- **Notes** is free text the user owns. **The application never writes to it.**
- **Receipt** is a picker with three values — `pending`, `checked`, `na` — chosen directly. It is
  not a cycle and there is no order to work through: a transaction is not on its way anywhere, it
  simply has one of three states and the user says which
  ([§6.3](06-categories.md#63-category-list)).
- The footer sums the filtered rows, across all pages.

## 5.2 Ordering and paging

- Always `date ASC, insertionSeq ASC, id ASC`. Columns are not sortable and the order is not
  configurable — the list must look identical every time it is opened.
- **50 rows per page.** This is the only paginated table in the application; every other table is
  shown in full.
- **The screen opens on the last page**, so the most recent rows are in view. Ascending order with a
  jump to the end keeps chronology reading the same direction everywhere while still landing on the
  rows just imported; the pager is how you go back.

## 5.3 Filters

Account · period · category · **set by** · amount range · receipt state · free-text search on
description. **The account filter lists cash accounts only** ([§2](02-domain-model.md)). Combined
with AND. Filters affect the footer totals and the page count. **No filter is applied by default** —
the screen opens on the whole history, and the period filter in the mockup is one the user set. The
category filter lists the twenty-seven categories **alphabetically**, with an *Uncategorised* entry
above them ([§6.3](06-categories.md#63-category-list)).

**Set by** filters on `categorySource`: *anything*, *a rule*, *by hand*. It is the filter for the
question the rules raise — after changing one, which rows did it take over, and which ones did I set
myself and would not want it to? Combined with a category it answers “show me everything a rule
called *Groceries*”, which is how a wrong rule is found; combined with *by hand* it lists the rows
that will survive every future rule change, which is the set worth keeping small.

## 5.4 Editing

- **Every cell is editable in place** — date, account, description, amount, category, receipt state,
  notes. Click to edit. The account picker offers only cash accounts; a transaction can never be
  moved onto a brokerage one.
- Setting a category by hand sets `categorySource = manual`, which protects it from every automatic
  re-categorisation.
- **The picker has no way to choose nothing.** It offers *Automatic* at the top and the twenty-seven
  categories **alphabetically** below it ([§6.3](06-categories.md#63-category-list)), and no
  clearing entry: a row the user has touched always ends up with a category or back under the rules
  ([§13](13-validation.md)). The only empty category in the file is therefore one no rule matched,
  which is exactly what check 2 is counting.
- **This is reversible.** The category picker offers a special entry — *Automatic (let rules
  decide)* — at the top of the list. Choosing it sets `categorySource` back to `automatic` and
  immediately re-applies the rule list to that transaction, leaving the category empty if no rule
  matches. There is no state a hand-edit can trap a row in.
- **Editing the description of an `automatic` row re-runs the rule list over that row** as the edit
  is committed. The description is the only thing a rule matches on, so changing it changes what the
  rules produce, and the row follows ([§2](02-domain-model.md)). A `manual` row keeps its category
  whatever its description becomes.
- Row menu: **Duplicate**, **Delete**. Delete asks for confirmation — there is no undo.
- **Duplicate copies the record and opens the copy for editing, immediately below the original.** It
  carries over account, date, description, amount, category and notes; it takes a new `id` and a new
  `insertionSeq`, which is what puts it there — same date, higher sequence, so the ordering of
  [§5.2](#52-ordering-and-paging) lands it in the next row down without anything having to place it.
  Change the date and it moves to where that date belongs, on the next redraw. Two fields do not come across as-is. `receiptState` resets to
  `na`, because a duplicate is a new row and every new row starts there whatever made it
  ([§6.3](06-categories.md#63-category-list)). `categorySource` is preserved: a copy of a hand-set
  row is itself hand-set and keeps the category, a copy of an automatic row is automatic and is
  re-derived from the description it inherited — which produces the same category, by the same rule,
  for the same reason. Duplicating is for the recurring payment that differs in one field, so it is
  worth the copy landing exactly where the original was and needing one edit.
- **“Duplicate” here is not the “duplicate” of [§5.7](#57-bulk-import).** This is an action that
  deliberately makes a second row; that is a detection that warns you may be about to make one by
  accident. They share a word and nothing else, and a row created by this action is not flagged by
  that detection — it is only consulted when rows are pasted.
- **There is no “apply rules” action on this screen.** The automatic categories in the file are
  always current, so a button that re-ran the rule list would have nothing left to do. The one place
  the list is applied is the Rules tab, and it is applied there as part of changing it
  ([§6.2](06-categories.md#62-rules)).

## 5.5 Add transaction

> **Mockup —** [Add transaction](../mockups/05-transactions.html#add-transaction)

- **Seven fields, in this order: account, date, description, amount, category, receipt, notes** —
  every stored field of a transaction that is not derived ([§2](02-domain-model.md)). Description is
  required and is the only thing a rule will match on ([§13](13-validation.md)); notes are optional
  and the application never writes to them ([§5.1](#51-columns)).
- **Account** defaults to the one last used, and lists cash accounts only — closed ones among them,
  marked and last ([§4.3](04-accounts.md#43-creating-and-editing)). **Date** is a date picker
  defaulting to today; **amount** is a validated numeric field, signed, negative being money out.
  Neither can hold text that would have to be interpreted: nothing invalid can be entered, so
  nothing invalid has to be rejected on save, and the display preferences of
  [§10](10-settings.md) never enter into data entry.
- **Category** defaults to *Automatic*, so a manually added row is categorised by the same rules as
  an imported one.
- **Receipt** defaults to *n/a* and stays there unless the user says otherwise, on this form as
  everywhere else ([§6.3](06-categories.md#63-category-list)). Nothing about the category the row
  ends up with changes it.
- **Save and add another** keeps the dialog open with account and date retained and the other fields
  cleared — the shape of manual entry is several rows in one sitting.

## 5.6 Selecting and deleting in bulk

- A **checkbox column** leads every row. Click one, shift-click another and the range between them
  is selected; the header checkbox selects **everything the filters currently match**, across pages,
  not just the page in view — which is the only way it is useful after an import that went into the
  wrong account.
- The only bulk action is **delete**. It confirms once, stating the count and the total amount about
  to disappear — *Delete 214 transactions totalling − € 8.412,90?* — because there is no undo
  ([§12](12-storage.md)) and the count alone does not tell you whether you selected the right
  fortnight.
- **There is no bulk edit.** Changing many categories at once is what rules are for
  ([§6.2](06-categories.md#62-rules)), and they do it repeatably and leave a reason behind; a bulk
  edit does it once and leaves nothing. Everything else worth changing on many rows at once is a
  mistake better deleted and re-imported.
- **Selection survives paging.** Turning the page keeps every tick, so a selection may span pages
  and the count in the header and the footer is the whole of it, not the part in view — which is the
  only reading under which the header checkbox means what [§5.6](#56-selecting-and-deleting-in-bulk)
  says it means. Coming back to a page shows the ticks still there.
- **Selection is cleared by any change to the filters, and by the bulk delete itself** — and by
  nothing else. A filter change is the one action that can put a selected row somewhere the user
  cannot see or reach it, so it is the one action that discards the selection rather than carrying
  an invisible one forward; and after a delete there is nothing left to have selected. Paging does
  not clear it, because the pager can always take you back.
- **A row edited out of the current filter keeps its tick and stays in the count.** Re-dating a
  selected transaction outside the period filter takes it off the screen, not out of the selection:
  it was chosen deliberately, one edit later it is still the same row, and silently dropping it
  would make the count in the header mean something different from what the user built. It is the
  same reading as paging — the row is out of view, not out of the set — and the way to let go of it
  is to touch the filters, which is the action that says so.

## 5.7 Bulk import

One screen. One job: get raw rows in without duplicating anything. It is reached from the *Bulk
import* button on the Transactions screen, and the sidebar stays on Transactions, because transactions are what it
produces — it is a mode of this screen rather than a destination of its own.

> **Mockup —** [Bulk import](../mockups/05-transactions.html#bulk-import)

### One screen

- **The paste box and the consequences of the paste are on screen together.** Row count, detected
  formats, preview, duplicate flags and the count on the *Import* button all update live as text is
  pasted or edited. There is no *Continue*, no review step and no way back: a mis-shaped paste is
  corrected where it was made, and the correction is visible without leaving the screen.
- This is the reason the two steps became one. A row that will not parse is almost always a format
  chip set wrongly, and a gate that refused to advance put the diagnosis on one screen and the chip
  that fixes it on the next.
- The **account is chosen once** for the whole paste, not per row. It defaults to the account last
  imported into, and lists cash accounts only — a brokerage account holds no transactions to import.
- **Fixed column order: date · description · amount**, one row per line, **columns separated by
  tabs**. A tab is what a spreadsheet puts on the clipboard, so a range copied out of an opened bank
  export arrives in the right shape without being reformatted. It is also the one separator that
  cannot occur inside a field: commas and semicolons both turn up in bank descriptions and in
  amounts, and either as a column boundary would split rows that are perfectly good.
- A line is split on tabs and each field trimmed; **a line that is empty or all whitespace is
  skipped silently**, not reported as unreadable, since a trailing newline is what every paste ends
  with.
- **Columns after the third are ignored**, not treated as an error. Exports routinely carry a
  running balance or a value date in a fourth column, and a row that carries the three things needed
  is a readable row whatever follows them. Only *fewer* than three columns makes a row unreadable.
- A single signed amount column; debit/credit pairs are not supported. Bank-specific import profiles
  are future work.

### Dates

- **The order is inferred from the pasted rows themselves**, never from the display preferences of
  [§10](10-settings.md) — the file came from a bank and has no reason to match how you like to read
  numbers. It is shown as a chip and **the chip is overridable**; changing it re-parses every row
  immediately.
- **Three orders are read: `DMY`, `MDY` and `YMD`.** The last is what an ISO date is, so
  `2026-07-11` needs no rule of its own.
- **The separator between the parts may be `/`, `-` or `.`**, and carries no meaning: it is not
  inferred, not shown on the chip, and a paste may mix rows that use different ones. It is the order
  that is ambiguous, never the punctuation.
- **The year may be four digits or two**, and a two-digit `YY` reads as `20YY`. A ledger that begins
  in 2016 has no use for 1926, and a bank that prints two digits is not offering to disambiguate
  them.
- Inference reads the whole column: a leading four-digit field settles `YMD`, a first part above 12
  settles `DMY`, a second part above 12 settles `MDY`. **When every row in the paste is ambiguous,
  `DMY` is assumed and the chip says so** — a fixed assumption written into the application, not a
  preference read from [§10](10-settings.md), and the thing to change when the preview looks wrong.
- Anything else in the date column — a month name, a weekday, a time appended after the date —
  **cannot be read** ([§15](15-out-of-scope.md)).

### Amounts

- **An amount carries exactly two decimals, and a row whose amount does not cannot be read.** The
  final `.` or `,` in the field must be followed by exactly two digits: `-54,80`, `1234.50` and
  `0,00` are amounts, and `12345`, `1.234` and `12,3` are not. It is the rule that removes every
  guess from this column — the alternative was inferring whether `1.234` meant one thousand or one
  and a bit, silently, on a row that looks perfectly ordinary and is out by a factor of a thousand
  when it is wrong.
- **Whichever character introduces those two digits is the decimal separator**, and the other one,
  where it appears, is the thousands separator grouping the integer part in threes. `1.234,56` and
  `1,234.56` are both read correctly, each row on its own evidence. **Thousands separators are
  optional**: `1234,56` is the same amount as `1.234,56`.
- **There is therefore no amount chip and nothing to override**, because nothing about an amount is
  inferred — every field says what it is or is not an amount. The one chip on this screen is the
  date order.
- The sign is a leading `-`, or nothing for money in. Trailing signs, parentheses and `D`/`C`
  markers are not read ([§15](15-out-of-scope.md)).
- **A bank export that writes whole euros as `1234` is reshaped before pasting, not guessed at.**
  Two decimals is what a statement prints, it costs one spreadsheet column to produce, and requiring
  it buys a column that is never wrong instead of one that is nearly always right.

### Rows that cannot be read

- A row with fewer than three columns, whose date does not parse under the current order, whose
  amount does not carry two decimals, or **whose description is empty** once trimmed, appears in the
  preview **marked with the reason, and cannot be ticked**. It is excluded from the count on the *Import* button and from the
  import. These are the transaction rules of [§13](13-validation.md) and nothing more — an import
  cannot write a row the form would have refused.
- **An amount of `0,00` reads fine and is imported.** It is a legal amount
  ([§13](13-validation.md)), banks post them, and a row is unreadable only when the amount cannot be
  understood — not when it is understood to be nothing.
- **An unreadable row never blocks the rows around it.** Import what is good, fix the rest, paste
  again — the duplicate detection below is what makes re-pasting safe.
- *Import* is disabled only while nothing is selected.

### Duplicates

- Exact match on **account + date + amount + normalised description** against transactions already
  in the file. Normalisation: trim, collapse whitespace, case-fold.
- A match is flagged and **unselected**, not removed. The user may re-select it.
- Rows within the paste are **never** compared with each other. Two identical rows in one paste that
  also match a single existing transaction are therefore **both** unselected — the application
  cannot tell which of them is the genuine second occurrence, so it hands both back for review
  rather than guessing.

### After import

Rows are inserted with `categorySource = automatic`, which means the rule list applies to them as
they are written and they arrive categorised wherever a rule matches ([§2](02-domain-model.md)).
**No categorisation is previewed on this screen** — the preview is about which rows come in, not
what they will be called. The user lands on Transactions filtered to the account imported into and
to the date range of the rows imported, where a wrong category can be fixed in place with the full
filter set available.

That filter is an ordinary account-and-period filter, reachable by hand like any other. Nothing is
stamped on the imported rows to make it possible: **an import leaves no trace on the transactions it
created**, and a row that came from a paste is indistinguishable from one typed by hand, which is
correct — they are the same kind of record.

---

[← §4 Accounts](04-accounts.md) · [§6 Categories →](06-categories.md)
