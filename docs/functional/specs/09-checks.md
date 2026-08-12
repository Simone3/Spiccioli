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
| 5 | Payslip pension contributions match transactions | Every **non-zero** pension figure on a payslip — employee share, employer share, TFR ([§2](02-domain-model.md)) — pairs one-to-one with a transaction in a role `pension contribution` category of the **same amount** — credits into the fund, so both sides are positive and are compared as they stand — dated in the payslip's month or the one after; and every such transaction pairs with one of those figures ([§11.6](11-calculations.md#116-derived-matching)). A figure of 0 expects no credit and takes no part. | Unmatched contribution figures — the payslip, which of the three, and the amount — and unmatched transactions, listed separately, with amounts. |
| 6 | Purchase transactions match purchases | Every transaction in a role `securities purchase` category pairs with a purchase trade, and vice versa. The money leaves the account, so the transaction is negative and the trade total positive: **`transaction.amount = − trade.total`** ([§11.6](11-calculations.md#116-derived-matching)). | Unmatched transactions and unmatched trades, listed separately. |
| 7 | Sale transactions match sales | As above for role `securities sale` and sale trades. The money arrives, so both sides carry the same sign: **`transaction.amount = trade.total`**, the trade side being net proceeds — after tax and fees — so it can equal what the bank credited. | As above. |
| 8 | No holding has gone negative | For every (security, account), the running quantity never drops below 0 **in the walk order of [§11.1](11-calculations.md#111-weighted-average-cost)** — by date, purchases before sales on a date they share. | Security, account, the trade that took it negative. |
| 9 | No sale precedes its purchase | Every sale has at least one purchase of that security in that account dated **on or before it**. **A purchase and a sale on one day satisfy it**: same-day round trips are ordinary, and the walk of [§11.1](11-calculations.md#111-weighted-average-cost) puts the purchase first. | The offending sale. |
| 10 | Pension fund revalued recently | Latest transaction in a role `value adjustment` category, in each **open** pension fund account, within `pensionRevaluationMonths`. An account that has never had one fails too. | Account and date of the last adjustment, or “never revalued”. |
| 11 | Closed accounts are empty | Every account with a `closingDate` has a balance of exactly 0 and no holding with quantity > 0. | Account, closing date, the balance or holdings left in it. |
| 12 | Records fall within their account's life | No transaction or trade is dated before its account's `openingDate` or after its `closingDate`. Both ends, not just the near one. | The record, its date, and the account's opening or closing date. |
| 13 | Receipt-tracked transactions carry a state | No transaction in a category with `receiptTracked` has `receiptState = na`. | Each such transaction. |
| 14 | No receipt has been pending too long | Every transaction with `receiptState = pending` is dated **within `receiptPendingMonths` of today** — the transaction's own date, not the moment the state was set. | Each overdue transaction, with its age. |

- **Two states only**, pass or fail. There is no warning tier.
- **A check never prevents anything.** Checks report; they do not validate, refuse or roll back. No
  save, close, delete or edit anywhere in the application is blocked because a check would fail
  afterwards — the record is written and the check names it on the next run, which is the same
  instant. Where a rule has to be enforced rather than observed, it is enforced by the form that
  collects it — a picker that offers only cash accounts, a date field that cannot hold a non-date —
  never by a check ([§13](13-validation.md)).
- **A failing check suspends the promise that the figures are right.** While one fails, figures that
  depend on what it names **may be undefined, may be wrong, and may disagree with each other**. That
  is the state the check exists to report: nothing invents a plausible value to paper over it,
  nothing is recomputed defensively around it, and this document does not enumerate what each failure
  does to each figure. Fix what the check names and the numbers are correct again.
- Each failing check **names the exact records**, and each entry links to the record it names. Check
  5's payslip-side entries name a figure on a payslip rather than the payslip as a whole, and say
  which of the three it is; the link is to the payslip.
- **A failing check lists at most five entries and states the whole count** — *showing 5 of 212* —
  and the five are the first five **in the order the screen those records live on shows them**:
  `date ASC, insertionSeq ASC, id ASC` for transactions and trades
  ([§5.2](05-transactions.md#52-ordering-and-paging),
  [§7.2](07-investments.md#72-purchases)), month then label for payslips
  ([§8.1](08-salaries.md#81-payslips)), ticker for securities
  ([§7.4](07-investments.md#74-securities)), and the order of
  [§4.1](04-accounts.md#41-accounts) for accounts. **There is
  no “show all”**, no paging inside a check and no scrolling list: the fix for a check naming two
  hundred records is the screen the records live on, which is one click away through any of the five
  links. **A check with two sides shows five of each**, with its own count on each — checks 4, 5, 6
  and 7 list unmatched records on both sides ([§11.6](11-calculations.md#116-derived-matching)).
- **The fourteen are always in the order of the table above**, failing and passing alike. Nothing
  sorts a failure to the top: a screen read every day is worth more when each check is where it was
  last time, and the count of what is failing is in the badge and the Portfolio banner already.
- A passing check **states its reach** (“117 payslips”, “41 purchases”), so a check that passed
  because it examined nothing is distinguishable from one that passed properly.
- Checks run **at application startup and after every change**, **debounced** — a change schedules a
  run rather than performing one, and a run in flight is superseded by the next. Typing in a cell
  produces one run when the typing stops, not one per keystroke. **There is no manual re-run.**
- They are summarised in the sidebar badge and the Portfolio banner. **The badge is a count of
  failing checks** — `3` against *Checks* means three of the fourteen fail, never how many records
  they name between them. Nothing at all is shown when every check passes
  ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)).
- **Check 13 fails immediately after an import, by design.** Receipt state is never set by the
  application ([§6.3](06-categories.md#63-category-list)): an imported row arrives `na`, so the
  rent, the electricity and the salary that just came in are all reported as untracked until the
  user goes through them. A row typed on the add-transaction form is the one that can be given its
  state as it is created ([§5.5](05-transactions.md#55-add-transaction)). **Check 14 cannot fail
  then, and the two are not a pair**: it examines only rows already moved to `pending`, and an
  imported row is `na`. 13 is the list of what has not been looked at; 14 is the list of what was
  looked at, marked as awaiting a document, and then left.
- **Check 14 ages the transaction, not the flag, and there is no “pending since” field.** A row from
  2019 marked `pending` this morning is overdue this morning.
- Checks key off category **roles** ([§2](02-domain-model.md)), never off category names.
- **No check compares absolute values.** Wherever two amounts are matched, the check states whether
  the two carry the **same** sign or **opposite** ones, and compares the signed figures: opposite for
  a transfer's two legs and for a purchase against its trade, the same for a sale, a salary and a
  pension credit ([§11.6](11-calculations.md#116-derived-matching)).
- **Every check reads the whole file, closed accounts included.** An unpaired transfer, an
  uncategorised row or a receipt left `pending` on an account shut in 2021 is as findable and as
  fixable as one on the current account ([§11.4](11-calculations.md#114-balances-and-net-worth),
  [§4.3](04-accounts.md#43-creating-and-editing)).
- **Check 10 is the one exception**: it reads **open pension fund accounts only**. What a closed
  pension fund still owes is an empty balance, and that is check 11's question, not this one.
- **What a run costs, and how it is implemented.** Fourteen checks over ten years is a handful of
  passes over the whole file — a few thousand transactions, a few dozen trades, a hundred-odd
  payslips — plus the greedy one-to-one matchers of
  [§11.6](11-calculations.md#116-derived-matching): checks 1, 4, 5, 6 and 7 each pair two sets
  against each other. Every one of those pairings keys off an **amount and a date window**, so **each side is
  bucketed by amount**, which turns the search for a counterpart into a lookup among the few records
  that could possibly match and keeps the run linear in the size of the file. **That is the intended
  implementation, not an optimisation to reach for later.** If it nevertheless proves too slow, the
  fallback is to keep running the cheap checks after every change and move the four matchers to a
  longer debounce. A manual re-run button is not the fallback and is out of scope
  ([§15](15-out-of-scope.md)).

### Deliberately not implemented

- **Statement balance reconciliation** — done by eye against the bank app after each import.
- **Duplicate transactions across the dataset** — genuine same-day, same-amount duplicates occur.
- **Sign vs. category type** — a refund legitimately zeroes out a purchase in an expense category.
- **Missing salary month** — gaps between jobs are legitimate.

---

## Why it is this way

- **There is no warning tier** because a middle state becomes a place for things to sit unfixed.
- **Checks report rather than prevent**, which is what makes them usable over a half-entered file:
  the ordinary way to work is to enter one side of something, watch a check fail, and enter the other
  side.
- **A failing check being allowed to poison the figures is what makes the rest of the specification
  affordable.** Every screen is written for a file whose checks pass, which is the file the user is
  meant to have, and the cases where a broken record would poison a figure are met once — by the
  check that names it — instead of at every total that touches it. The handful of readings this
  document *does* fix for a failing state are there because the honest answer was cheap and the
  dishonest one was dangerous: a holding with no price is worth zero rather than worth its cost
  ([§11.3](11-calculations.md#113-hypothetical-liquidation)), an oversold position yields no holding
  at all rather than a plausible average cost
  ([§11.1](11-calculations.md#111-weighted-average-cost)), and a realised gain with no cost basis
  reads *undefined* rather than nothing ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)).
  They are examples of refusing to guess, not the beginning of a catalogue: no further case is
  specified, and none should be invented.
- **Checks 8 and 9 overlap on purpose.** A sale with no purchase dated on or before it also drives
  the running quantity below zero, so 9 never fails alone — but the two say different things when you
  read the failure. 8 reports a quantity that cannot exist; 9 reports a sale standing where no
  purchase precedes it, which is the same anomaly seen from the record that caused it rather than
  from the arithmetic that broke. **Both turn on the same-day rule, and both take it the same way**:
  a purchase and a sale on one day is a round trip somebody made, so 9 counts the purchase and the
  walk of [§11.1](11-calculations.md#111-weighted-average-cost) puts it first, which leaves 8 passing
  too. Had 9 asked for a *strictly* earlier purchase it would have failed alone on every same-day
  round trip, and the claim that it never does would have been false. Both are anomalies and neither
  is a stage of ordinary work: the usual causes are a purchase never entered and a date mistyped, and
  the position stays underived until one of the two is put right ([§2](02-domain-model.md)). Keeping
  both costs nothing and names the situation the way the user is thinking about it.
- **Check 5 pairs each contribution separately** because that is how the money moves: employee share,
  employer share and TFR reach the fund as separate credits, so the payslip records three figures
  ([§2](02-domain-model.md)) and each pairs with the credit that carries it — the same one-to-one
  shape as check 4, with nothing to reconcile as a total. One combined figure would have forced a
  comparison of monthly totals, and there two adjacent months' windows overlap and compete for the
  same credit: whichever way that is resolved, a credit can end up claimed by one month and expected
  by the other, and a stray credit in a month that has already been compared has nowhere to be
  reported. A zero figure takes no part because it is not a credit that failed to arrive — it is a
  heading the payslip has nothing under, which is the ordinary state of the employer share on a
  tredicesima. Demanding a `0,00` credit for it would fail on every fund statement ever printed.
- **The badge counts checks rather than records** because a record count would leap about as one
  import landed and say nothing about how much is wrong. **There is no manual re-run** because a
  result that could be stale enough to need one would not be worth showing in a badge.
- **Five entries and a count, rather than all of them.** Check 13 fails on every receipt-tracked row
  the moment an import lands, which is hundreds, and check 2 on a half-migrated file can be
  thousands; a screen that listed them would be a second Transactions screen with worse filters and
  no editing, and the fourteen checks would stop being readable at a glance. Five is enough to see
  *what kind* of thing is wrong — which is the question this screen answers — and the count is what
  says how much of it there is. The remedy was never on this screen anyway: every entry links to the
  row, and the row is where it gets fixed.
- **The order of the fourteen is fixed for the same reason the report's rows are**
  ([§6.1](06-categories.md#61-report)): a list that rearranged itself as things broke and were mended
  would have to be re-read from the top every time, and the one piece of information sorting would
  add — how many are failing — is already the badge.
- **Check 13 failing after an import is the to-do list working, not a defect** — the alternative was
  an application that quietly marked a receipt as expected and let the user believe someone had
  looked at it.
- **Check 14 ages the transaction deliberately**: what it asks is whether a document that ought to
  exist is still outstanding, and a payment from three years ago has no business waiting on one
  whenever somebody got round to marking it. Dating the flag instead would let an old row be marked
  and then sit for another three months before anything said so, and would put a second date in the
  file to keep in step with the first.
- **Keying off roles rather than names** means rewording a label never silently switches a check off.
- **Signed comparison is what catches sign errors.** Amounts are signed ([§2](02-domain-model.md))
  and the sign is information — a securities purchase recorded as money *in* is a mistake worth
  reporting, and a matcher working on magnitudes would have paired it and said nothing. The unmatched
  record is then named by the check, which is exactly where a sign error should surface.
- **Closed accounts are read** because nothing about a closing date makes a record less true, and the
  checks are about the records.
- **Check 10's exception is about meaning rather than about scope.** It asks whether a pension fund
  is being kept in step with its real value, which is a question about a fund you still hold. The
  alternative was a check that failed forever on an account closed years ago, with no legitimate way
  to satisfy it — a value adjustment dated after the closing date would immediately fail check 12
  instead.
- **The matchers are bucketed because a careless implementation makes them quadratic.** At this size
  a linear run is fast enough to be invisible, which is the only reason a debounced run after every
  change is a reasonable thing to ask for. The fallback is not a manual re-run button, which would
  put a stale badge on screen and make the user responsible for noticing; the order of preference is
  to make the run cheap, then make it less frequent, and only then make it manual — and the third is
  out of scope.

---

[← §8 Salaries](08-salaries.md) · [§10 Settings →](10-settings.md)
