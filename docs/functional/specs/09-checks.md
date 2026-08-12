# §9 — Checks

*[Index](../README.md) · [mockups for this section](../mockups/09-checks.html)*

Fourteen checks. Each passes or names the exact records that made it fail. No tabs.

> **Mockup —** [Checks screen](../mockups/09-checks.html#checks)

---

| # | Check | Definition | Failure output |
| --- | --- | --- | --- |
| 1 | Internal transfers balance out | Every transaction in a category with role `internal transfer` pairs with a leg of the **exactly opposite amount** — `a.amount = − b.amount` — on another account ([§11.6](11-calculations.md#116-derived-matching)). | Each unpaired leg, with date, account, description, amount. |
| 2 | Every transaction has a category | `categoryId` is set. | Each uncategorised transaction. |
| 3 | Prices are recent | Every security with an open holding has at least one Price record, and its latest one is dated within `priceStalenessDays`. **No price at all fails too**, and is the more serious of the two: that holding is valued at zero everywhere ([§11.3](11-calculations.md#113-hypothetical-liquidation)). | Security, price, date, age — or “no price recorded”. |
| 4 | Payslips match salary transactions | Every payslip pairs one-to-one with a transaction in a role `salary` category whose amount is **`+ netPayment`** — pay arrives, so the transaction is positive and the two are equal as they stand — dated in the payslip's month or the one after; and every such transaction pairs with a payslip ([§11.6](11-calculations.md#116-derived-matching)). | Unmatched payslips and unmatched transactions, listed separately, with amounts. |
| 5 | Payslip pension contributions match transactions | **Monthly totals, not record by record.** For each month, Σ `pensionContribution` over that month's payslips = Σ of the role `pension contribution` transactions attributed to it — credits into the fund, so both sides are positive and are compared as they stand — each month claiming the credits in its window in date order and **stopping at the first that would take it past its own total**, which is left unclaimed and reported against the month it sits in ([§11.6](11-calculations.md#116-derived-matching)). A month's contribution reaches the fund as two or three separate credits — employee share, employer share, TFR — so pairing them one to one could never have worked. **Both directions**: a month that expected nothing and received something fails exactly as a month that expected something and received nothing. Only months where both totals are zero are silent. | The month, the payslip total, the transaction total, and the difference — linking to the payslip that carried the contribution, or, for a month that has none, saying so: credits arrived in a month with no payslip to expect them. |
| 6 | Purchase transactions match purchases | Every transaction in a role `securities purchase` category pairs with a purchase trade, and vice versa. The money leaves the account, so the transaction is negative and the trade total positive: **`transaction.amount = − trade.total`** ([§11.6](11-calculations.md#116-derived-matching)). | Unmatched transactions and unmatched trades, listed separately. |
| 7 | Sale transactions match sales | As above for role `securities sale` and sale trades. The money arrives, so both sides carry the same sign: **`transaction.amount = trade.total`**, the trade side being net proceeds — after tax and fees — so it can equal what the bank credited. | As above. |
| 8 | No holding has gone negative | For every (security, account), running quantity in date order never drops below 0. | Security, account, the trade that took it negative. |
| 9 | No sale precedes its purchase | Every sale has at least one earlier purchase of that security in that account. | The offending sale. |
| 10 | Pension fund revalued recently | Latest transaction in a role `value adjustment` category, in each **open** pension fund account, within `pensionRevaluationMonths`. An account that has never had one fails too. | Account and date of the last adjustment, or “never revalued”. |
| 11 | Closed accounts are empty | Every account with a `closingDate` has a balance of exactly 0 and no holding with quantity > 0. | Account, closing date, the balance or holdings left in it. |
| 12 | Records fall within their account's life | No transaction or trade is dated before its account's `openingDate` or after its `closingDate`. Both ends, not just the near one. | The record, its date, and the account's opening or closing date. |
| 13 | Receipt-tracked transactions carry a state | No transaction in a category with `receiptTracked` has `receiptState = na`. | Each such transaction. |
| 14 | No receipt has been pending too long | Every transaction with `receiptState = pending` is dated **within `receiptPendingMonths` of today** — the transaction's own date, not the moment the state was set. | Each overdue transaction, with its age. |

> **A failing check suspends the promise that the figures are right, and nothing is designed around
> that.** A check fails because the file contradicts itself, and the application's whole answer to a
> file that contradicts itself is the check: it names the records, and the records get fixed. While
> one fails, figures that depend on what it names **may be undefined, may be wrong, and may disagree
> with each other**, and that is not a defect to be handled — it is the state the check exists to
> report. Nothing invents a plausible value to paper over it, nothing is recomputed defensively
> around it, and this document does not enumerate what each failure does to each figure. Fix what the
> check names and the numbers are correct again.
>
> **That is what makes the rest of the specification affordable.** Every screen is written for a file
> whose checks pass, which is the file the user is meant to have, and the cases where a broken record
> would poison a figure are met once — by the check that names it — instead of at every total that
> touches it. The handful of readings this document *does* fix for a failing state are there because
> the honest answer was cheap and the dishonest one was dangerous: a holding with no price is worth
> zero rather than worth its cost ([§11.3](11-calculations.md#113-hypothetical-liquidation)), an
> oversold position yields no holding at all rather than a plausible average cost
> ([§11.1](11-calculations.md#111-weighted-average-cost)), and a realised gain with no cost basis
> reads *undefined* rather than nothing ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)).
> They are examples of refusing to guess, not the beginning of a catalogue: no further case is
> specified, and none should be invented.

**Checks 8 and 9 overlap on purpose.** Any sale with no purchase before it also drives the running
quantity below zero, so 9 never fails alone — but the two say different things when you read the
failure. 8 reports a quantity that cannot exist; 9 reports a sale standing where no purchase
precedes it, which is the same anomaly seen from the record that caused it rather than from the
arithmetic that broke. Both are anomalies and neither is a stage of ordinary work: the usual causes
are a purchase never entered and a date mistyped, and the position stays underived until one of the
two is put right ([§2](02-domain-model.md)). Keeping both costs nothing and names the situation the
way the user is thinking about it.

- **Two states only**, pass or fail. No warning tier — it would become a place for things to sit
  unfixed.
- **A check never prevents anything.** Checks report; they do not validate, refuse or roll back. No
  save, close, delete or edit anywhere in the application is blocked because a check would fail
  afterwards — the record is written and the check names it on the next run, which is the same
  instant. This is what makes them usable over a half-entered file: the ordinary way to work is to
  enter one side of something, watch a check fail, and enter the other side. Where a rule has to be
  enforced rather than observed, it is enforced by the form that collects it — a picker that offers
  only cash accounts, a date field that cannot hold a non-date — never by a check.
- A passing check **states its reach** (“117 payslips”, “41 purchases”), so a check that passed
  because it examined nothing is distinguishable from one that passed properly.
- Checks run **at application startup and after every change**, **debounced** — a change schedules a
  run rather than performing one, and a run in flight is superseded by the next. Typing in a cell
  produces one run when the typing stops, not one per keystroke. They are summarised in the sidebar
  badge and the Portfolio banner. **The badge is a count of failing checks** — `3` against *Checks*
  means three of the fourteen fail, never how many records they name between them, which would be a
  number that leapt about as one import landed and said nothing about how much is wrong. Nothing at
  all is shown when every check passes ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)). There is no manual re-run button: a result that could be stale
  enough to need one would not be worth showing in a badge.
- Each failing entry links to the record it names. **Check 5 is the one entry that is not a record**
  — it is a month — so it links to the payslip whose contribution it was comparing against; a month
  that has no payslip at all has nothing to link to and says that instead, which is the more useful
  half of the finding anyway.
- **Check 13 fails immediately after an import, by design.** Receipt state is never set by the
  application ([§6.3](06-categories.md#63-category-list)): an imported row arrives `na`, so the
  rent, the electricity and the salary that just came in are all reported as untracked until the
  user goes through them. A row typed on the add-transaction form is the one that can be given its
  state as it is created ([§5.5](05-transactions.md#55-add-transaction)) — an import has no such
  moment, being one paste and hundreds of rows. That is the to-do list working, not a defect — the alternative was an application
  that quietly marked a receipt as expected and let the user believe someone had looked at it.
  **Check 14 cannot fail then, and the two are not a pair**: it examines only rows already moved to
  `pending`, and an imported row is `na`. 13 is the list of what has not been looked at; 14 is the
  list of what was looked at, marked as awaiting a document, and then left.
- **Check 14 ages the transaction, not the flag, and there is no “pending since” field.** A row from
  2019 marked `pending` this morning is overdue this morning. That is the intended reading rather
  than an oversight: what the check asks is whether a document that ought to exist is still
  outstanding, and a payment from three years ago has no business waiting on one whenever somebody
  got round to marking it. Dating the flag instead would let an old row be marked and then sit for
  another three months before anything said so, and would put a second date in the file to keep in
  step with the first.
- Checks key off category **roles** ([§2](02-domain-model.md)), never off category names, so
  rewording a label never silently switches a check off.
- **No check compares absolute values.** Wherever two amounts are matched, the check states whether
  the two carry the **same** sign or **opposite** ones, and compares the signed figures: opposite for
  a transfer's two legs and for a purchase against its trade, the same for a sale, a salary and a
  pension credit. Amounts are signed ([§2](02-domain-model.md)) and the sign is information — a
  securities purchase recorded as money *in* is a mistake worth reporting, and a matcher working on
  magnitudes would have paired it and said nothing. The unmatched record is then named by the check,
  which is exactly where a sign error should surface.
- **Every check reads the whole file, closed accounts included.** A closed account keeps its
  history, keeps its balance in every total
  ([§11.4](11-calculations.md#114-balances-and-net-worth)) and keeps its rows editable — it is still
  in every picker, marked and last ([§4.3](04-accounts.md#43-creating-and-editing)) — so an unpaired
  transfer, an uncategorised row or a receipt left `pending` on an account shut in 2021 is as
  findable and as fixable as one on the current account. Nothing about a closing date makes a record
  less true, and the checks are about the records.
- **Check 10 is the one exception, and it is an exception about meaning rather than about scope.**
  It asks whether a pension fund is being kept in step with its real value, which is a question about
  a fund you still hold: it reads **open pension fund accounts only**. The alternative was a check
  that failed forever on an account closed years ago, with no legitimate way to satisfy it — a value
  adjustment dated after the closing date would immediately fail check 12 instead. What a closed
  pension fund still owes is an empty balance, and that is check 11's question, not this one.

> **What a run actually costs.** Fourteen checks over ten years is a handful of passes over the
> whole file — a few thousand transactions, a few dozen trades, a hundred-odd payslips — plus the
> greedy one-to-one matchers of [§11.6](11-calculations.md#116-derived-matching), which are the
> expensive part: checks 1, 4, 6 and 7 each pair two sets against each other, and a careless
> implementation makes that quadratic. It does not need to be. Every one of those pairings keys off
> an **amount and a date window**, so bucketing each side by amount turns the search for a
> counterpart into a lookup among the few records that could possibly match, and the run stays
> linear in the size of the file. **That is the intended implementation, not an optimisation to
> reach for later** — at this size it is fast enough to be invisible, which is the only reason a
> debounced run after every change is a reasonable thing to ask for.
>
> If it nevertheless proves too slow, the fallback is **not** a manual re-run button, which would
> put a stale badge on screen and make the user responsible for noticing. It is to keep running the
> cheap checks after every change and move the four matchers to a longer debounce, so the badge is
> never wrong for more than a moment. The order of preference is: make the run cheap, then make it
> less frequent, and only then make it manual — and the third is out of scope
> ([§15](15-out-of-scope.md)).

### Deliberately not implemented

- **Statement balance reconciliation** — done by eye against the bank app after each import.
- **Duplicate transactions across the dataset** — genuine same-day, same-amount duplicates occur.
- **Sign vs. category type** — a refund legitimately zeroes out a purchase in an expense category.
- **Missing salary month** — gaps between jobs are legitimate.

---

[← §8 Salaries](08-salaries.md) · [§10 Settings →](10-settings.md)
