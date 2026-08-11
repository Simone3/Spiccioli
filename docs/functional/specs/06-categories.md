# §6 — Categories

*[Index](../README.md) · [mockups for this section](../mockups/06-categories.html)*

Three tabs: Report, Rules, Category list. The report answers where the money goes, the rules put it
there, and the list is what both are made of.

---

## 6.1 Report

The categories × years matrix — the one screen that answers where the money goes.

> **Mockup —** [Report tab](../mockups/06-categories.html#report)

- Rows are categories, **in the fixed order of the category list** ([§6.3](#63-category-list)) —
  never by amount. Columns are calendar years plus a total. **The whole table is shown; there is no
  paging.**
- **Three of the four groups are a single type; the fourth is three.** Income, Expense and Internal
  each hold the categories of the type they are named after. *Investments* holds the `Investment`,
  `Divestment` and `Revaluation` types together, because buying, selling and revaluing are one
  activity to a reader and three types only to the model — and because three groups of one category
  each, stacked, would have been three headings for three rows.
- **The order never moves.** Sorting by total would have put the biggest number at the top of each
  group, which reads well once and badly forever: change the year filter and every row jumps, so the
  eye has to find *Groceries* again instead of going straight to where it was last time. A table
  read every month is worth more when its shape is memorised, and that is only possible if the shape
  is a constant. The same order is used on the list tab and in every category picker, so a category
  is always in the same place wherever it appears.
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
  row total drops the year. It is the answer to the question the table always provokes: *what is in
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
- The screen carries three tabs: this report, the categorisation rules ([§6.2](#62-rules)), and a
  read-only list of the twenty-seven categories with their types and roles
  ([§6.3](#63-category-list)). Rules sit here because the tester's counts only mean something next
  to the report they change.
- Uncategorised transactions appear in no row. Their existence is a failing check, not a silent
  omission.
- **Total income is money that arrived, not money that was earned.** It adds net salary, the
  employer's pension contributions and meal-voucher top-ups, which are three different things with
  one property in common: each increased what the portfolio is worth. It is therefore not comparable
  to gross pay, not a tax base, and not what anyone means by an annual salary —
  [§8.1](08-salaries.md#81-payslips) is the screen for those. The line is the top of a cash-flow
  statement, and the figure it exists to produce is **Net**, further down.
- **Salary** here is the sum of *Salary* transactions, i.e. net payments received — not gross pay.
  Gross figures live on the Salaries screen ([§8.1](08-salaries.md#81-payslips)). Because a payslip
  for December is typically paid in January, a calendar year of Salary transactions need not line up
  exactly with that year's payslips; [§8.1](08-salaries.md#81-payslips) is the screen that reads
  payslip by payslip.

## 6.2 Rules

> **Mockup —** [Rules tab](../mockups/06-categories.html#rules)

- Ordered, draggable, numbered. **First match wins**, so order is the logic and must be visible. A
  rule is created with the substring and the category; nothing else.
- The tester counts what the rule under edit would match, split into already-this-category,
  currently uncategorised, and hand-set to something else, with sample matching descriptions. **It
  previews the rule as edited, before the edit is committed** — which is why it can report rows that
  are currently uncategorised even though a committed rule would already have caught them. It is the
  answer to “what will this do?”, asked before it does it.
- **Every committed change to the list re-categorises immediately.** Adding, editing, deleting or
  dragging a rule re-runs the whole list over every transaction whose `categorySource = automatic`,
  as the change is made. A `manual` category is never touched. There is no apply button, because an
  automatic category that disagreed with the rules would break the invariant of
  [§2](02-domain-model.md) — and the moment there is a button, there is a file in which it has not
  been pressed.
- **Deleting a rule therefore un-categorises the rows only it matched**, unless a rule further down
  the list picks them up. That is the visible consequence of the rule above rather than a surprise,
  and it is what the tester's counts are for reading before deleting. Rows set by hand keep their
  category regardless.
- The *Applies to* counts are computed against current data, so they never go stale.
- **Eleven rules is the mockup, not the expectation.** A real file runs to several dozen, and the
  target is that **the rules categorise about 95% of transactions** and the remaining twentieth is
  set by hand — one-off transfers, gifts, the payment whose description is a reference number. That
  ratio is what makes the absence of a bulk edit tolerable
  ([§5.6](05-transactions.md#56-selecting-and-deleting-in-bulk)): if a quarter of the file needed
  touching by hand, the rules would be the thing that was wrong.

> **If it turns out to be too slow.** Re-running several dozen rules over ten years of transactions
> is a scan of the whole file, debounced behind each rule edit. If that proves too slow to do on
> every commit, the fallback is **two explicit buttons**, and the difference between them is the
> whole point: *Apply rules to uncategorised* touches only the rows with no category, which is a
> handful after an import and costs nothing, while *Re-categorise all rule-assigned* is the full
> pass over every `automatic` row and is what a changed or reordered rule actually needs. The
> invariant of [§2](02-domain-model.md) relaxes with them, to “whatever the rule list produced when
> it was last run”. That is a worse specification and it is not the one being built; it is written
> down so the trade is made deliberately rather than discovered.

## 6.3 Category list

Twenty-seven, seeded into every new file and not editable at runtime. Adding one is a change to the
application. **Role** is what [§9](09-checks.md) keys off; a blank one means no check cares about
the category. **Was** records the old Italian label for reference only — the migration script maps
the two lists by hand, and the application stores no alias.

> **Mockup —** [Category list tab](../mockups/06-categories.html#category-list)

- **Read-only, and the only place the whole taxonomy is visible at once.** Its types and roles
  decide how every other screen adds things up, so being able to look at them without reading this
  document is worth a tab even though nothing on it can be changed.
- **The order of this list is the order of everything.** Its `order` field
  ([§2](02-domain-model.md)) fixes where a category sits in the report, in this list and in every
  picker, and no screen ever re-sorts by amount ([§6.1](#61-report)).
- The **Transactions** column is a live count and the reason the tab is more than decoration: a
  category with none is one the rules never reach, and the total across all 27 is every categorised
  transaction in the file — 4.811 of 4.812 here, the missing one being the failure of check 2.
- Adding, renaming or removing a category is a change to the application, not a setting
  ([§15](15-out-of-scope.md)).

| Category | Type | Role | Was | Receipt tracked |
| --- | --- | --- | --- | --- |
| Salary | Income | salary | Stipendio | ✓ |
| Pension fund contribution | Income | pension contribution | Contribuzione fondo pensione | |
| Reimbursement | Income | — | Rimborso | |
| Gift received | Income | — | Regalo | |
| Other income | Income | — | Altra entrata | |
| Interest, dividends & bonuses | Income | interest and dividends | Interessi, dividendi e bonus | |
| Voucher top-up | Income | — | Aggiunta voucher | |
| Securities purchase | Investment | securities purchase | Acquisto titoli | |
| Securities sale | Divestment | securities sale | Vendita titoli | |
| Restaurants & bars | Expense | — | Ristorante e bar | |
| Groceries | Expense | — | Supermercato | |
| Travel | Expense | — | Viaggio | |
| Home & household | Expense | — | Casa | |
| Rent & condominium fees | Expense | — | Affitto e spese condominiali | ✓ |
| Electricity | Expense | — | Luce | ✓ |
| Home internet | Expense | — | Internet casa | ✓ |
| Mobile & phone | Expense | — | Internet telefono | ✓ |
| Entertainment | Expense | — | Intrattenimento | |
| Other expense | Expense | — | Altro pagamento | |
| Bank fees | Expense | bank fees | Costo banca | |
| Income & other taxes | Expense | — | Tassa non patrimoniale | ✓ |
| Wealth tax | Expense | wealth tax | Tassa patrimoniale | |
| Culture & education | Expense | — | Cultura | |
| Health & personal care | Expense | — | Salute e persona | |
| Technology & devices | Expense | — | Tecnologia e devices | |
| Internal transfer | Internal | internal transfer | Trasferimento interno | |
| Value adjustment | Revaluation | value adjustment | — new — | |

- **Value adjustment** carries the manual correction that realigns an account's balance with its
  real value when that value moves on its own — the pension fund's underlying investments being the
  only current case. It counts towards balances and the portfolio total and is excluded from every
  income and expense aggregate. Historical rows that used *Contribuzione fondo pensione* for this
  purpose must be remapped on migration.
- The **receipt tracked** column marks categories whose transactions are *expected* to carry a
  receipt state other than `na` — the document that ought to exist somewhere for that payment: the
  invoice for the electricity, the contract for the rent, and for *Salary* the payslip itself, which
  is also the record [§8.1](08-salaries.md#81-payslips) is built from. It changes nothing about what
  gets recorded: **receipt state is entered by hand and by nothing else**. Every transaction is
  created `na` — typed, imported, duplicated, however it arrived — and moves only when the user
  moves it ([§5.1](05-transactions.md#51-columns)).
- **Checks 13 and 14 therefore fail the moment a receipt-tracked row is created**, and that is the
  point. The rent that was just imported *is* outstanding until someone has looked for the invoice,
  and the check is the list of what to look for. An application that set the state to `pending` on
  the user's behalf would have been guessing, and one that set it to `checked` would have been
  lying; the only honest default is the one that says nobody has been near this yet.
- An amount whose sign contradicts its category type is **legal and not flagged** — a refund
  routinely zeroes out a purchase inside an expense category.

---

[← §5 Transactions](05-transactions.md) · [§7 Investments →](07-investments.md)
