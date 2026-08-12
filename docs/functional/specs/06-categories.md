# §6 — Categories

*[Index](../README.md) · [mockups for this section](../mockups/06-categories.html)*

Three tabs: Report, Rules, Category list. The report answers where the money goes, the rules put it
there, and the list is what both are made of.

---

## 6.1 Report

The categories × years matrix — the one screen that answers where the money goes.

> **Mockup —** [Report tab](../mockups/06-categories.html#report)

- Rows are categories, **in the fixed `order` of [§2](02-domain-model.md)** — never by amount, and
  never alphabetically. Columns are calendar years plus a total. **The whole table is shown; there is
  no paging.**
- **`order` exists for this table and is numbered to suit it.** It runs down the report's own reading
  order — the Income group, then Expense, then Internal, then the Investments group below Net — so
  the table ascends in it from top to bottom and the group boundaries fall where the numbering
  changes type. Nothing else in the application reads the field
  ([§6.3](#63-category-list)).
- **Three of the four groups are a single type; the fourth is three.** Income, Expense and Internal
  each hold the categories of the type they are named after. *Investments* holds the `Investment`,
  `Divestment` and `Revaluation` types together, because buying, selling and revaluing are one
  activity to a reader and three types only to the model — and because three groups of one category
  each, stacked, would have been three headings for three rows.
- **The order never moves.** Sorting by total would have put the biggest number at the top of each
  group, which reads well once and badly forever: change the year filter and every row jumps, so the
  eye has to find *Groceries* again instead of going straight to where it was last time. A table
  read every month is worth more when its shape is memorised, and that is only possible if the shape
  is a constant. **This is the one table that reads in `order`; everywhere else categories are
  alphabetical** — the list tab, every picker and every filter ([§6.3](#63-category-list)).
- Amounts **carry the sign and colour of the transactions behind them** — income green and positive,
  expense red and negative — exactly as on the Transactions screen. Absolute values with the
  direction implied by the group header would have read fine for Income and Expense and lied about
  the two groups that have no fixed direction: inside *Investments* a purchase goes out and a sale
  comes back, and a pension fund that lost value produces a negative value adjustment; inside
  *Internal* the two legs are a plus and a minus by definition.
- **Four groups, and every category appears in exactly one of them.** *Income*, *Expense* and
  *Internal* each list their categories and end in a subtotal; **Net** is the sum of those three
  subtotals and is the emphasised line the table exists to produce. *Investments* follows below it,
  listing the remaining three categories and **ending in nothing**, and is excluded from Net. Seven
  plus sixteen plus one plus three is twenty-seven ([§6.3](#63-category-list)): the report accounts
  for the whole taxonomy, once each, which is what makes “the money is not in this table” a
  statement about the file rather than about the report.
- **Internal belongs above the line, not beside it.** Unfiltered it is zero — both legs of every
  transfer are in scope and cancel — so folding it into Net changes nothing, which is precisely why
  it is safe. **Filtered to a subset of accounts it stops being zero by design**, because the
  transfers crossing the boundary of the selection no longer have both legs in view; and that is
  exactly when you want it in Net, because then Net reads as what actually happened to the money in
  the accounts you selected. A year filtered to one savings account should say the balance went up
  by what arrived, and most of what arrives in a savings account is a transfer.
- **A non-zero Internal with no account filter means a leg is missing**, and now it moves Net by
  that amount instead of sitting harmlessly to one side. That is not a new risk: the same condition
  fails check 1 by name, so the Portfolio banner is already up and the Checks screen already names
  the unpaired leg ([§9](09-checks.md)). The row stays visible for the same reason it always was —
  it is the one place the damage is quantified.
- **Investments is a section, not a leftover.** It answers the question Net provokes — *where did
  the surplus go?* — with the three categories that move money between the spendable side of the
  portfolio and the invested side, or revalue what is already there. It sits below Net because none
  of it is income or expenditure: a purchase is not a cost, it is the same money in a different
  shape.
- **Investments carries no subtotal, and that is the point of it.** Securities purchase and sale are
  cash that moved through a bank account; a value adjustment is not — it is the pension fund being
  marked to its real value, and no money changed hands. Adding the three together would produce a
  figure that is neither the cash invested nor the change in what the investments are worth, and it
  would be smaller than the cash invested by exactly the revaluation — a number nobody asked for,
  wrong for both questions anyone would ask of it. The three rows answer those questions separately
  and are each a link; a summary line here would only be read as though it meant something.
- **A subtotal exists where something is built out of it.** Income, Expense and Internal have one
  because *Net* is their sum and the reader needs to see the three figures it is made of. Nothing is
  built out of Investments, so nothing is added up.
- **Every figure in a category row is a link.** Clicking a cell opens Transactions filtered to that
  category and that year — plus whatever account filter the report already has — and clicking the
  row total drops the year. What opens is the ordinary Transactions screen on its last page, with
  those filters set and nothing else different about it
  ([§5.2](05-transactions.md#52-ordering-and-paging)). It is the answer to the question the table always provokes: *what is in
  there?* Without it the matrix reports a number and leaves the user to reconstruct the filter by
  hand on another screen, which is the sort of small friction that ends with a spreadsheet being
  opened instead.
- **The three subtotals and Net are not links**, because no filter expresses them: the category
  filter takes one category, and *Net* is a sum of sums rather than a selection. Nothing is offered
  that cannot then be shown. **Every other row in the table is a category, and therefore is a link**
  — transfers, purchases, sales and revaluations included, which is the other thing listing them as
  categories buys: the whole table is navigable, not just the top two thirds of it.
- A cell with no transactions shows an em dash, not `€ 0,00`, so a real zero stays distinguishable
  from nothing recorded — and an em dash is not a link.
- Filters: year range, accounts — **cash accounts only**, since a brokerage account holds no
  transactions to report ([§2](02-domain-model.md)). A partial year is labelled with the months it
  covers.
- **Closed accounts are in the report and in its account filter**, marked and last like everywhere
  else ([§4.3](04-accounts.md#43-creating-and-editing)). The report is a history of where the money
  went, and the money that went through an account shut in 2021 went somewhere: leaving it out would
  make every year before that one disagree with itself depending on what has been closed since.
  Closing an account takes nothing out of anything — not its past here and not its balance on
  Portfolio ([§11.4](11-calculations.md#114-balances-and-net-worth)); it marks the account and sorts
  it last.
- The screen carries three tabs: this report, the categorisation rules ([§6.2](#62-rules)), and a
  read-only list of the twenty-seven categories with their types and roles
  ([§6.3](#63-category-list)). Rules sit here because what a rule change does is move figures in
  this report, and the two are worth being a tab apart.
- Uncategorised transactions appear in no row. Their existence is a failing check, not a silent
  omission.
- **Total income is money that arrived, not money that was earned.** It adds the pay that reached
  the bank, the pension fund contributions and the meal-voucher top-ups, which are three different
  things with one property in common: each increased what the portfolio is worth. It is therefore
  not comparable to gross pay, not a tax base, and not what anyone means by an annual salary —
  [§8.1](08-salaries.md#81-payslips) is the screen for those. The line is the top of a cash-flow
  statement, and the figure it exists to produce is **Net**, further down.
- **Salary** here is the sum of *Salary* transactions: what the bank actually received, which is a
  payslip's `netPayment` ([§2](02-domain-model.md)) and the figure check 4 pairs against. **It is
  not the *netSalary* of [§11.7](11-calculations.md#117-salary-figures)**, which adds the car
  deduction back and takes the refunds out to say what the month was worth as pay — a different
  question, answered on a different screen, and the two are worth keeping apart by name because
  “net salary” said loosely means either. Gross figures live on Salaries as well
  ([§8.1](08-salaries.md#81-payslips)). Because a payslip for December is typically paid in January,
  a calendar year of Salary transactions need not line up exactly with that year's payslips;
  [§8.1](08-salaries.md#81-payslips) is the screen that reads payslip by payslip.

## 6.2 Rules

> **Mockup —** [Rules tab](../mockups/06-categories.html#rules)

- Ordered, draggable, numbered. **First match wins**, so order is the logic and must be visible. A
  rule is created with the substring and the category; nothing else.

### The list is edited as a session, and applied once

- **Editing the list changes nothing until *Apply changes* is pressed.** Add a rule, edit another,
  delete a third, drag two into a different order — all of it accumulates on the screen as a
  **draft**, and neither the rules nor a single transaction's category is written while it does. The
  header says how many changes are pending, *Apply changes* is enabled only while there are some,
  and *Discard changes* puts the list back to what the file holds.
- **The unit of work is the edit session, not the keystroke.** A rule list is reasoned about as a
  whole — a new rule usually wants to sit above an existing one, which means an edit and a drag that
  are only correct together — and applying each half as it happens would re-categorise the file
  twice, the first time into a state nobody asked for. It is also the only way a drag can be part of
  the same decision as the rule it moves.
- **Apply asks first, and what it shows is the consequence rather than the diff.** Pressing it runs
  the draft list over every transaction whose `categorySource = automatic`, compares the result with
  what those rows carry now, and reports:
  - **how many transactions change from one category to another**, the number that says a rule took
    over rows another one was catching;
  - **how many lose their category**, the rows a deleted or narrowed rule was the only match for;
  - **how many currently uncategorised gain one**, which is what a new rule is usually for;
  - **how many are unchanged**, so the three figures above are read against the size of the file;
  - and **a line per rule that was added, edited, moved or deleted**, with what each accounted for.
- Confirm and the rules and every affected category are written **together, in one step**. Cancel
  and nothing at all is written: the draft is still on the screen, exactly as it was, and can be
  edited further or discarded. **A `manual` category is never touched by any of this**
  ([§2](02-domain-model.md)).
- **Leaving the tab, closing the file or quitting with a draft pending asks what to do with it** —
  apply, discard, or stay. A draft is the one thing in the application that is not in the file the
  moment it is typed, so it is the one thing that has to be asked about before it can be lost.
- **The *Applies to* column describes the applied list**, not the draft: it counts the transactions
  each rule currently accounts for in the file. While a draft is pending it is dimmed and labelled
  as such, because a count that silently switched between describing the file and describing a
  proposal would be the one number on the screen nobody could trust.
- **There is no per-rule tester.** The question worth answering is what the *list* will do, and a
  panel that answered it one rule at a time could not answer it for a drag at all — reordering is
  the edit most likely to change a category, and it has no rule under edit to hang a preview on. One
  summary over the whole draft says everything the per-rule counts said and the thing they could
  not.
- **Deleting a rule un-categorises the rows only it matched**, unless a rule further down the list
  picks them up. That is arithmetic, not a surprise, and it is the second figure in the summary —
  which is the number to read before confirming a delete.
- **The mockup's eleven rules are not the expectation.** A real file runs to several dozen, and the
  target is that **the rules categorise about 95% of transactions** and the remaining twentieth is
  set by hand — one-off transfers, gifts, the payment whose description is a reference number. That
  ratio is what makes the absence of a bulk edit tolerable
  ([§5.6](05-transactions.md#56-selecting-and-deleting-in-bulk)): if a quarter of the file needed
  touching by hand, the rules would be the thing that was wrong.

> **What this costs to run.** One apply is one pass of several dozen rules over ten years of
> transactions, and the pass that produces the summary is the same pass that produces the result —
> compute it once, show the figures, and write what was already computed if the user confirms.
> Nothing is recomputed on confirmation. That is the whole reason the summary is affordable at all,
> and it is also why the previous design — re-running the list behind every keystroke — is not
> missed.

## 6.3 Category list

Twenty-seven, seeded into every new file and not editable at runtime. Adding one is a change to the
application. **Role** is what [§9](09-checks.md) keys off; a blank one means no check cares about
the category. **Was** records the old Italian label for reference only — the migration script maps
the two lists by hand, and the application stores no alias.

> **Mockup —** [Category list tab](../mockups/06-categories.html#category-list)

- **Read-only, and the only place the whole taxonomy is visible at once.** Its types and roles
  decide how every other screen adds things up, so being able to look at them without reading this
  document is worth a tab even though nothing on it can be changed.
- **This list is alphabetical by name**, and so is every picker and every filter — the category
  picker on a transaction, the category filter, the category on a rule. This tab is opened to look
  one category up: to see what type *Voucher top-up* is, whether *Wealth tax* carries a role, why a
  figure landed where it did. That is the same action a picker serves, and the place to look a name
  up is the alphabet.
- **The report is the one table that reads in `order` instead** ([§6.1](#61-report)), because it is
  read down rather than looked up in — a matrix whose shape is worth memorising, grouped by type,
  with subtotals that only mean anything if the rows above them are the right ones. The two orders
  serve two different actions and neither is improved by matching the other, so the `order` value is
  a column here rather than the arrangement of the page: this tab is where you can see what the
  report's order actually is.
- Only the entries that are not categories sit outside the alphabet: *Automatic* at the top of the
  transaction picker and *Uncategorised* at the top of the filter
  ([§5.3](05-transactions.md#53-filters), [§5.4](05-transactions.md#54-editing)).
- The **Transactions** column is a live count and the reason the tab is more than decoration: a
  category with none is one the rules never reach, and the total across all 27 is every categorised
  transaction in the file — 4.811 of 4.812 in the mockup, the missing one being the failure of check 2.
- Adding, renaming or removing a category is a change to the application, not a setting
  ([§15](15-out-of-scope.md)).

Listed as the tab lists them, **alphabetically**. `Order` is the report's row order
([§6.1](#61-report)) and is the only thing that reads in a sequence of its own.

| Category | Type | Role | Order | Was | Receipt tracked |
| --- | --- | --- | --- | --- | --- |
| Bank fees | Expense | bank fees | 18 | Costo banca | |
| Culture & education | Expense | — | 21 | Cultura | |
| Electricity | Expense | — | 13 | Luce | ✓ |
| Entertainment | Expense | — | 16 | Intrattenimento | |
| Gift received | Income | — | 4 | Regalo | |
| Groceries | Expense | — | 9 | Supermercato | |
| Health & personal care | Expense | — | 22 | Salute e persona | |
| Home & household | Expense | — | 11 | Casa | |
| Home internet | Expense | — | 14 | Internet casa | ✓ |
| Income & other taxes | Expense | — | 19 | Tassa non patrimoniale | ✓ |
| Interest, dividends & bonuses | Income | interest and dividends | 6 | Interessi, dividendi e bonus | |
| Internal transfer | Internal | internal transfer | 24 | Trasferimento interno | |
| Mobile & phone | Expense | — | 15 | Internet telefono | ✓ |
| Other expense | Expense | — | 17 | Altro pagamento | |
| Other income | Income | — | 5 | Altra entrata | |
| Pension fund contribution | Income | pension contribution | 2 | Contribuzione fondo pensione | |
| Reimbursement | Income | — | 3 | Rimborso | |
| Rent & condominium fees | Expense | — | 12 | Affitto e spese condominiali | ✓ |
| Restaurants & bars | Expense | — | 8 | Ristorante e bar | |
| Salary | Income | salary | 1 | Stipendio | ✓ |
| Securities purchase | Investment | securities purchase | 25 | Acquisto titoli | |
| Securities sale | Divestment | securities sale | 26 | Vendita titoli | |
| Technology & devices | Expense | — | 23 | Tecnologia e devices | |
| Travel | Expense | — | 10 | Viaggio | |
| Value adjustment | Revaluation | value adjustment | 27 | — new — | |
| Voucher top-up | Income | — | 7 | Aggiunta voucher | |
| Wealth tax | Expense | wealth tax | 20 | Tassa patrimoniale | |

**Read down the `Order` column and the report appears**: 1 – 7 are the Income group, 8 – 23 the
Expense group, 24 the Internal group, and 25 – 27 the Investments group that sits below Net
([§6.1](#61-report)). The numbering is contiguous and every category has one, which is what lets the
report sort on a single field and still come out grouped.

- **Value adjustment** carries the manual correction that realigns an account's balance with its
  real value when that value moves on its own — the pension fund's underlying investments being the
  only current case. It counts towards balances and the portfolio total and is excluded from every
  income and expense aggregate. Historical rows that used *Contribuzione fondo pensione* for this
  purpose must be remapped on migration.
- The **receipt tracked** column marks categories whose transactions are *expected* to carry a
  receipt state other than `na` — the document that ought to exist somewhere for that payment: the
  invoice for the electricity, the contract for the rent, and for *Salary* the payslip itself, which
  is also the record [§8.1](08-salaries.md#81-payslips) is built from. It changes nothing about what
  gets recorded: **receipt state is entered by hand and by nothing else**. It defaults to `na`
  everywhere, and the add-transaction form is the one place it can be given another value as the row
  is created ([§5.5](05-transactions.md#55-add-transaction)) — a row that arrives imported or
  duplicated is created `na` and moved on the row itself
  ([§5.1](05-transactions.md#51-columns)).
- **Check 13 therefore fails the moment a receipt-tracked row is imported**, and that is the point.
  The rent that was just imported *is* outstanding until someone has looked for the invoice, and the
  check is the list of what to look for. A row typed by hand can be given its state on the form and
  need never appear in that list at all, which is the difference between one row and two hundred. An application that set the state to `pending` on the
  user's behalf would have been guessing, and one that set it to `checked` would have been lying;
  the only honest default is the one that says nobody has been near this yet. **Check 14 says
  nothing at that moment** — it reads only rows already moved to `pending`, so it starts counting
  after the user has been through them, not before ([§9](09-checks.md)).
- An amount whose sign contradicts its category type is **legal and not flagged** — a refund
  routinely zeroes out a purchase inside an expense category.

---

[← §5 Transactions](05-transactions.md) · [§7 Investments →](07-investments.md)
