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
- **Matched** is derived and read-only, and it names the counterpart for **every** kind of pairing
  [§11.6](11-calculations.md#116-derived-matching) makes, not some of them: the counterpart account
  for a paired internal transfer, the security for a trade-matched securities transaction, and the
  **payslip** for a salary transaction paired with one or a pension contribution attributed to one —
  its month and its label, *December 2025* or *December 2025 · 13th*. An em dash otherwise. A row
  that a check has quietly paired and a row nothing has touched must not look the same, or the
  column answers a different question in each half of the file.
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
- **However the screen is reached, it is the same screen.** Arriving from a report cell
  ([§6.1](06-categories.md#61-report)) or from a finished import ([§5.7](#57-bulk-import)) sets the
  filters and changes nothing else: the last page of what those filters match, the same ordering,
  the same everything. A screen that behaved one way when opened from the sidebar and another way
  when linked to would be two screens wearing one name, and the filters it arrives with are ones the
  user could have set by hand in a few seconds.

## 5.3 Filters

Account · period · category · **set by** · amount range · receipt state · free-text search on
description. **The account filter lists cash accounts only** ([§2](02-domain-model.md)). Combined
with AND. Filters affect the footer totals and the page count. **No filter is applied by default** —
opened from the sidebar the screen shows the whole history, and the period filter in the mockup is
one the user set. The two ways in that arrive with filters already set say so as they hand over
([§5.2](#52-ordering-and-paging)): a report cell and a finished import both set them where the user
would have, and both leave every control free to be changed or cleared. The
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
  `na`, because a duplicate is a row nobody has looked at yet whatever the original's state was, and
  the add-transaction form is the only place a state is chosen as a row is created
  ([§5.5](#55-add-transaction), [§6.3](06-categories.md#63-category-list)). `categorySource` is preserved: a copy of a hand-set
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
- **Account** starts empty and lists cash accounts only — closed ones among them, marked and last
  ([§4.3](04-accounts.md#43-creating-and-editing)). **No picker in the application remembers what was
  chosen last**: there is nowhere for that memory to live, the file holding the eleven entities and
  nothing else ([§12](12-storage.md)) and preferences being the closed list of
  [§10](10-settings.md) — and a default carried over from a previous sitting is a default nobody
  sees themselves accept. Which account a row belongs to is the one field on this form that cannot
  be inferred from anything else on it, so it is the one that is always chosen.
  **Date** is a date picker
  defaulting to today; **amount** is a validated numeric field, signed, negative being money out.
  Neither can hold text that would have to be interpreted: nothing invalid can be entered, so
  nothing invalid has to be rejected on save, and the display preferences of
  [§10](10-settings.md) never enter into data entry.
- **Category** defaults to *Automatic*, so a manually added row is categorised by the same rules as
  an imported one.
- **Receipt** defaults to *n/a*, and this form is **the one place a row can be given a state before
  it exists**: the picker offers all three values and whatever it holds on save is what the row is
  created with. One row typed by hand is a row whose document you either have in front of you or do
  not, so asking here costs nothing and saves a second visit. Every other way a row arrives — an
  import, a duplicate — creates it `na` and leaves the state to be moved afterwards, a paste being
  hundreds of rows and no moment at which the question could sensibly be asked
  ([§5.7](#57-bulk-import), [§6.3](06-categories.md#63-category-list)). Nothing about the category
  the row ends up with changes it, on this form as everywhere else.
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
- **Selection survives paging, and nothing else.** Turning the page keeps every tick, so a selection
  may span pages and the count in the header and the footer is the whole of it, not the part in view
  — which is the only reading under which the header checkbox means what
  [§5.6](#56-selecting-and-deleting-in-bulk) says it means. Coming back to a page shows the ticks
  still there, because the pager can always take you back to them.
- **Every other action clears it**: changing a filter, editing any cell, a row-menu *Duplicate* or
  *Delete*, leaving the screen, and the bulk delete itself. The rule is one line rather than a list
  of exceptions on purpose. A selection is a short-lived thing built for one action — filter, tick,
  delete — and the moment anything else happens the set the user assembled may no longer be the set
  the screen would describe: a filter change hides rows, an edit can move one out of view, and a
  screen left and returned to is a fresh start by every other reckoning in the application. Carrying
  an invisible selection across any of that puts a count in the header that nobody can verify
  against what is in front of them, and the confirmation on the bulk delete is the last place to
  discover that the count means something else.
- **This is cheap to lose and expensive to get wrong.** Re-ticking is a filter and one click on the
  header checkbox; deleting the wrong fortnight has no undo ([§12](12-storage.md)).

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
- The **account is chosen once** for the whole paste, not per row. It **starts empty and is the first
  thing to pick** ([§5.5](#55-add-transaction)), and lists cash accounts only — a brokerage account
  holds no transactions to import. It is the field a remembered default would do the most damage in:
  two hundred rows landing in last month's account is precisely the mistake bulk delete exists to
  undo ([§5.6](#56-selecting-and-deleting-in-bulk)).
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
- **The year is always four digits.** A two-digit year cannot be read and the row is marked like any
  other unreadable one. Two digits would have to be resolved by a rule the paste gives no evidence
  for, and it is the one part of a date that can be wrong by a century without looking wrong at all
  — where a swapped day and month at least produces a date the eye can catch. Widening a year column
  is one spreadsheet operation, the same one the amount column already asks for.
- Inference reads the whole column: a four-digit field first settles `YMD`, a first part above 12
  settles `DMY`, a second part above 12 settles `MDY`. **When every row in the paste is ambiguous,
  `DMY` is assumed and the chip says so** — a fixed assumption written into the application, not a
  preference read from [§10](10-settings.md), and the thing to change when the preview looks wrong.
- **Contradictory evidence settles nothing, and is not resolved silently.** If one row settles `DMY`
  and another `MDY` there is no order that reads the whole paste: the chip takes the order the first
  decisive row settles, and the rows contradicting it appear as unreadable with the reason. Flipping
  the chip flips which half is readable, which is the paste telling you it holds two date formats
  and wants splitting in two. Guessing per row was the alternative, and a column that reads
  `03/04/2026` one way on one line and the other way on the next is the kind of wrong that is never
  found.
- **A date that parses into a day that does not exist cannot be read** — `31/02/2026` is three
  numbers in the right shape and not a date, and it is marked rather than rolled into March.
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
- *Import* is disabled while no account is chosen or no row is selected, and by nothing else
  ([§13](13-validation.md)). The account being unset is the ordinary state of a screen just opened,
  so it is half of what that button is waiting for.

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
they are written and they arrive categorised wherever a rule matches ([§2](02-domain-model.md)), and
with `receiptState = na`. **The paste has no receipt column and the screen has no picker for one**:
the state is a fact about a document the user has or has not found, asked once per row on the
add-transaction form ([§5.5](#55-add-transaction)) and set on the rows themselves afterwards. It is
why check 13 fails straight after an import, which is that check working
([§6.3](06-categories.md#63-category-list), [§9](09-checks.md)).
**No categorisation is previewed on this screen** — the preview is about which rows come in, not
what they will be called. The user lands on Transactions filtered to the account imported into and
to the date range of the rows imported — the ordinary screen on its last page, with two filters
already set ([§5.2](#52-ordering-and-paging)) — where a wrong category can be fixed in place with
the full filter set available.

That filter is an ordinary account-and-period filter, reachable by hand like any other. Nothing is
stamped on the imported rows to make it possible: **an import leaves no trace on the transactions it
created**, and a row that came from a paste is indistinguishable from one typed by hand, which is
correct — they are the same kind of record.

---

[← §4 Accounts](04-accounts.md) · [§6 Categories →](06-categories.md)
