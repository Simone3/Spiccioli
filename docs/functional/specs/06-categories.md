# §6 — Categories

*[Index](../README.md) · [why it is this way](../why/06-categories.md)*

Three tabs: Report, Rules, Category list. The report answers where the money goes, the rules put it there, and the list is what both are made of.

---

## 6.1 Report

The categories × years matrix — the one screen that answers where the money goes.

- Rows are categories, **in the fixed `order` of [§2](02-domain-model.md)** — never by amount, and never alphabetically. Columns are calendar years plus a total. **The whole table is shown; there is no paging.**
- **`order` exists for this table and is numbered to suit it.** It runs down the report's own reading order — the Income group, then Expense, then Internal, then the Investments group below Net — so the table ascends in it from top to bottom and the group boundaries fall where the numbering changes type. Nothing else in the application reads the field ([§6.3](#63-category-list)).
- **This is the one table that reads in `order`; everywhere else categories are alphabetical** — the list tab, every picker and every filter ([§6.3](#63-category-list)).
- **Four groups, and every category appears in exactly one of them.** *Income*, *Expense* and *Internal* each list the categories of the type they are named after and end in a subtotal; **Net** is the sum of those three subtotals and is the emphasised line the table exists to produce. *Investments* follows below it, holding the `Investment`, `Divestment` and `Revaluation` types together, **ending in nothing**, and excluded from Net. Seven plus sixteen plus one plus three is twenty-seven ([§6.3](#63-category-list)): the report accounts for the whole taxonomy, once each.
- **What Net is, exactly.** It is the sum of the Income, Expense and Internal subtotals, and it is **neither cash flow nor income in any accounting sense**. Three properties decide its shape and each is deliberate:
  - **It counts money that never reached a bank account.** A pension fund contribution is `Income` ([§6.3](#63-category-list)), and the employee's share of it was withheld from pay rather than paid out — so Net includes it, correctly, because net worth went up by exactly that.
  - **It excludes what was bought and sold**, the Investments group sitting below it. A securities purchase is not a cost and a sale is not income: both are the same money in a different shape. This is what stops a sale's return of capital being counted as earnings.
  - **It excludes what the investments did.** A value adjustment is a `Revaluation` and is out; a realised capital gain arrives inside a sale amount and goes out with it.
- **So Net is what the income left over after the spending**, and the one asymmetry worth naming is that **interest and dividends sit inside it while realised capital gains do not**. Both are investment returns; the line drawn between them is cash income against capital, and it is a line rather than a principle.
- **Net reconciles to nothing else in the application, and is not meant to.** Not to the change in cash, because the Investments group moved cash too. Not to the change in net worth, because the investments changed that without passing through this table at all.
- Amounts **carry the sign and colour of the transactions behind them** — income green and positive, expense red and negative — exactly as on the Transactions screen.
- **Internal is inside Net.** With the account filter on *All* its **row total** is zero, both legs of every transfer being in scope and cancelling. **Filtered to one account it stops being zero by design**, because a transfer in or out of that account has only one leg in view, and Net then reads as what actually happened to the money in the account selected.
- **A single year's cell is a different matter, and one exception is ordinary.** A transfer sent in December and received in January has its two legs in two calendar years, so both years' Internal cells are non-zero and the two cancel only in the row total. Nothing is wrong: the money did leave one year and arrive in the next, and Net reads it that way in both. **Only the row total is expected to be zero.**
- **Beyond that, a non-zero Internal row total with the account filter on *All* means a leg is missing**, and it moves Net by that amount. Check 1 is failing while it is true — an unpaired leg is exactly what that check reports — so the Portfolio banner is already up and the Checks screen already names the leg ([§9](09-checks.md)); the row is where the damage is quantified. **The implication runs one way only:** check 1 also fails on two legs that cancel perfectly but sit further apart than `transferMatchWindowDays` ([§10](10-settings.md)), or whose credit is dated more than `transferMatchBackwardDays` before its debit ([§11.6](11-calculations.md#116-derived-matching)), and both of those leave the row total at zero.
- **Every figure in a category row is a link.** Clicking a cell opens Transactions filtered to that category and to that year — the period set to its first and last day — **plus the report's account filter, which is one account or *All* and transfers as it stands** ([§5.3](05-transactions.md#53-filters)). **Clicking the row total carries the same category and account, with the period set to the whole of what the table is showing** — the first day of the earliest column to the last day of the latest. On *Last 5* that is a five-year window; on *All* it is the first transaction's year to the current one, which selects every transaction there is. **The period is set rather than cleared**, because the row total is the sum of the columns on screen and a filter handed to another screen has to select the rows the figure was made of ([§5.3](05-transactions.md#53-filters)). What opens is the ordinary Transactions screen on its first page, with those filters set and nothing else different about it ([§5.2](05-transactions.md#52-ordering-and-paging)).
- **The three subtotals and Net are not links.** **Every other row in the table is a category, and therefore is a link** — transfers, purchases, sales and revaluations included.
- A cell with no transactions shows an em dash, not `€ 0,00`, so a real zero stays distinguishable from nothing recorded — and an em dash is not a link.
- **Two filters: years and account.**
  - **Years takes one of two values — *Last 5* or *All*, and it opens at *Last 5*.** That is what it opens at the first time the screen is opened; coming back to it from the sidebar finds it on whatever it was left on ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)). It is a picker over a closed set of two, **not a range**: there is no *from* and *to* here, unlike the period filter of [§5.3](05-transactions.md#53-filters). *Last 5* is the current year and the four before it, so the columns run 2022 – 2026 in a file read in 2026; a file holding fewer than five years of transactions shows what it has.
  - ***All* runs from the year of the earliest transaction in the file to the current year, and every year between them gets a column** — a year in the middle with nothing recorded in it included, which is what makes the sequence continuous and a gap in the history visible as a gap rather than as an absence. Such a year's category cells are em dashes like any other cell with nothing behind them, and its subtotals and Net read `€ 0,00`.
  - **The range is the transactions' own**, and deliberately not the file's start of [§11.5](11-calculations.md#115-net-worth-over-time): this table reports transactions and nothing else, so an account opened three years before its first row, or a trade predating every bank export, adds no column to it.
  - **Account — one account or *All***, **cash accounts only**, since a brokerage account holds no transactions to report ([§2](02-domain-model.md), [§5.3](05-transactions.md#53-filters)).
- A partial year is labelled with the months it covers.
- **Closed accounts are in the report and in its account filter**, marked and last like everywhere else ([§4.3](04-accounts.md#43-creating-and-editing)). Closing an account takes nothing out of anything — not its past here and not its balance on Portfolio ([§11.4](11-calculations.md#114-balances-and-net-worth)); it marks the account and sorts it last.
- The screen carries three tabs: this report, the categorisation rules ([§6.2](#62-rules)), and a read-only list of the twenty-seven categories with their types ([§6.3](#63-category-list)).
- Uncategorised transactions appear in no row. Their existence is a failing check ([§9](09-checks.md)).
- **Total income is money that arrived, not money that was earned.** It adds the pay that reached the bank, the pension fund contributions and the meal-voucher top-ups. It is not comparable to gross pay, not a tax base, and not what anyone means by an annual salary — [§8.1](08-salaries.md#81-payslips) is the screen for those.
- **Salary** here is the sum of *Salary* transactions: what the bank actually received, which is a payslip's `netPayment` ([§2](02-domain-model.md)) and the figure check 4 pairs against. **It is not the *netSalary* of [§11.7](11-calculations.md#117-salary-figures)**, which adds the car deduction back and takes the refunds out. Gross figures live on Salaries as well ([§8.1](08-salaries.md#81-payslips)). Because a payslip for December is typically paid in January, a calendar year of Salary transactions need not line up exactly with that year's payslips; [§8.1](08-salaries.md#81-payslips) is the screen that reads payslip by payslip.

## 6.2 Rules

- Ordered, draggable, numbered. **First match wins**, so order is the logic and is visible. A rule is created with the substring and the category; nothing else.

### The list is edited as a session, and applied once

- **Editing the list changes nothing until *Apply changes* is pressed.** Add a rule, edit another, delete a third, drag two into a different order — all of it accumulates on the screen as a **draft**, and neither the rules nor a single transaction's category is written while it does. The header says how many changes are pending, *Apply changes* is enabled only while there are some, and *Discard changes* puts the list back to what the file holds.
- **Apply asks first, and what it shows is the consequence rather than the diff.** Pressing it runs the draft list over every transaction whose `categorySource = automatic`, compares the result with what those rows carry now, and reports:
  - **how many transactions change from one category to another**;
  - **how many lose their category**, the rows a deleted or narrowed rule was the only match for;
  - **how many currently uncategorised gain one**;
  - **how many are unchanged**.
- **Those four figures are the whole summary, and there is no breakdown by edit.** The decision being taken is whether to apply the list as it now stands, and the four totals are what the file looks like once it has been.
- Confirm and the rules and every affected category are written **together, in one step**. Cancel and nothing at all is written: the draft is still on the screen, exactly as it was, and can be edited further or discarded. **A `manual` category is never touched by any of this** ([§2](02-domain-model.md)).
- **Leaving the tab, closing the file or quitting with a draft pending warns that the changes are unsaved**, and offers exactly two ways out: **discard**, which throws the draft away and proceeds, and **stay**, which cancels the departure and leaves the draft on screen untouched. **There is no *apply* on that prompt.** Applying is a decision taken against the consequence summary above, which states how many transactions change, lose a category or gain one before anything is written; a dialog raised by walking away is the wrong place to take it, and an *apply* button there would let a rule change be committed by someone whose actual intention was to leave.
- **The *Applies to* column describes the applied list**, not the draft: it counts the transactions each rule currently accounts for in the file. While a draft is pending it is dimmed and labelled as such.
- **What "accounts for" means, exactly, and it is narrower than "matches".** A transaction counts towards a rule only where **that rule is the first one in the list to match it** — first match wins, so a row a rule matches but an earlier rule already claimed belongs to the earlier one and is counted there. And only **`automatic` rows are counted at all**: a `manual` row is one no rule may touch ([§2](02-domain-model.md)), so a rule whose substring appears in fifty hand-set descriptions accounts for none of them. **The column therefore sums to the number of categorised `automatic` transactions in the file**, once each, which is what makes a rule reading *0 transactions* a fact worth acting on rather than an artefact — it is a rule that is either shadowed by one above it or matching nothing at all ([§13](13-validation.md)).
- **There is no per-rule tester.**
- **Deleting a rule un-categorises the rows only it matched**, unless a rule further down the list picks them up. That is the second figure in the summary. **The deletion is confirmed there rather than at the click**: a rule removed from a draft has changed nothing in the file yet, so *Apply changes* and its summary are the confirmation, and this is the one delete in the application that is confirmed later rather than where it is made ([§13](13-validation.md)).
- **A handful of rules is not the expectation.** A real file runs to several dozen, and the target is that **the rules categorise about 95% of transactions**, the remaining twentieth being set by hand — one-off transfers, gifts, the payment whose description is a reference number.

## 6.3 Category list

Twenty-seven, seeded into every new file and not editable at runtime. Adding, renaming or removing one is a change to the application, not a setting ([§15](15-out-of-scope.md)). **The tab shows four columns — name, type, receipt tracked and a live transaction count.** The table further down carries what the screen does not: **role**, which is what [§9](09-checks.md) and the *gains and costs* card of [§3.1](03-portfolio.md#31-behaviour) key off — a blank one means no check and no card cares about the category — **order**, the report's row order ([§6.1](#61-report)), and **was**, the old Italian label, recorded for reference only: the migration script maps the two lists by hand, and the application stores no alias.

- **Read-only, and the only place the whole taxonomy is visible at once.**
- **This list is alphabetical by name**, and so is every picker and every filter — the category picker on a transaction, the category filter, the category on a rule.
- **The report is the one table that reads in `order` instead** ([§6.1](#61-report)).
- **Neither `role` nor `order` is shown.** Both are wiring rather than facts about the money: nothing on any screen can set them, and a column of mostly blank roles reads as a setting somebody forgot to fill in. They are stored, they are what the checks and the report read ([§2](02-domain-model.md)), and they are written down in the table below.
- Only the entries that are not categories sit outside the alphabet: *Automatic* at the top of the transaction picker and *Uncategorised* at the top of the filter ([§5.3](05-transactions.md#53-filters), [§5.4](05-transactions.md#54-editing)).
- The **Transactions** column is a live count: a category with none is one the rules never reach, and the total across all 27 is every categorised transaction in the file, falling short of the transactions the file holds by exactly the uncategorised ones — which are the failure of check 2.

Listed as the tab lists them, **alphabetically**, and with `Role` and `Order` alongside — the two the tab does not show ([§9](09-checks.md), [§6.1](#61-report)).

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

**Read down the `Order` column and the report appears**: 1 – 7 are the Income group, 8 – 23 the Expense group, 24 the Internal group, and 25 – 27 the Investments group that sits below Net ([§6.1](#61-report)). The numbering is contiguous and every category has one, which is what lets the report sort on a single field and still come out grouped.

- **Value adjustment** carries the manual correction that realigns an account's balance with its real value when that value moves on its own. **A pension fund is the only case anything in the application asks for** — check 10 prompts a revaluation there and nowhere else ([§9](09-checks.md)), and the pension arithmetic of [§11.3](11-calculations.md#113-hypothetical-liquidation) is the only thing that reads the split of one account. **The role is read in one more place**: the *gains and costs* card sums it over the whole file and over every account, where it is mostly the pension fund's decade of growth ([§3.1](03-portfolio.md#31-behaviour)). **The category is not restricted to that account type**, though: it is legal on any cash account, and a term deposit accruing interest it has not yet been paid is the case where someone might reasonably use it ([§15](15-out-of-scope.md)). Nothing prompts for one there and nothing ever will in v1. It counts towards balances and the portfolio total and is excluded from every income and expense aggregate. Historical rows that used *Contribuzione fondo pensione* for this purpose must be remapped on migration.
- The **receipt tracked** column marks categories whose transactions are *expected* to carry a receipt state other than `na` — the document that ought to exist somewhere for that payment: the invoice for the electricity, the contract for the rent, and for *Salary* the payslip itself, which is also the record [§8.1](08-salaries.md#81-payslips) is built from. It changes nothing about what gets recorded: **receipt state is entered by hand and by nothing else**. It defaults to `na` everywhere, and the add-transaction form is the one place it can be given another value as the row is created ([§5.5](05-transactions.md#55-add-transaction)) — a row that arrives imported or duplicated is created `na` and moved on the row itself ([§5.1](05-transactions.md#51-columns)). **That is a statement about the application, not about the file**: the ten years of history are written by the migration script, which sets each row's state along with everything else it knows ([§12](12-storage.md), [§13.1](13-validation.md#131-how-it-behaves)).
- **Check 13 therefore fails the moment a receipt-tracked row is imported.** **Check 14 says nothing at that moment** — it reads only rows already moved to `pending` ([§9](09-checks.md)).
- An amount whose sign contradicts its category type is **legal and not flagged**.

---

[← §5 Transactions](05-transactions.md) · [§7 Investments →](07-investments.md)
