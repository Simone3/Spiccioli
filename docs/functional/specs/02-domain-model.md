# §2 — Domain model

*[Index](../README.md) · no mockups for this section*

Eleven stored entities and one derived one. *Italic* marks a derived field.

---

## Institution

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| name | text | Fineco, ING, Amundi, Edenred… |
| defaultSellFee | amount | Flat. Used only for hypothetical liquidation figures ([§11.3](11-calculations.md#113-hypothetical-liquidation)). |
| notes | text | |

## Account

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| name | text | |
| institutionId | ref? | **Required on every type but `Liquidity`** ([§13](13-validation.md)). Physical cash is the account that has none, and it is a `Liquidity` one. |
| type | enum | `Liquidity` · `Deposit account` · `Term deposit` · `Pension fund` · `Voucher` · `Brokerage` |
| openingBalance | amount | Default 0. For accounts whose history starts mid-life. Always 0 on a `Brokerage` account. |
| openingDate | date | Records dated before it are reported by check 12, never prevented. |
| closingDate | date? | Empty means open. An account is closed by editing it and setting this date; there is no other retirement mechanism. |
| notes | text | |
| *status* | *enum* | `closed` when `closingDate` is set, `open` otherwise. A closed account keeps its history **and keeps its balance in every total** ([§11.4](11-calculations.md#114-balances-and-net-worth)); closing marks it and sorts it last, it does not take it out of the arithmetic. |
| *balance* | *amount* | Cash accounts: openingBalance + Σ transaction amounts. Brokerage: Σ holding `netProceeds` — net of the hypothetical tax and sell fee of [§11.3](11-calculations.md#113-hypothetical-liquidation), per [§11.4](11-calculations.md#114-balances-and-net-worth). |

**Cash and securities never live in the same account.** The five cash types hold transactions and no
holdings; `Brokerage` holds holdings and no transactions. A broker is therefore two accounts — a
`Liquidity` one for uninvested cash, a `Brokerage` one for the securities — and the money leaving
the first to fund a purchase is what check 6 pairs against the trade recorded in the second.
`Liquidity` otherwise covers current accounts and physical cash.

**The split runs all the way out to every account list in the application.** Anywhere accounts are
offered — a form's picker, a screen's filter — the list holds only the kind that screen can contain:
**cash accounts** where transactions are created, edited, imported, filtered or reported
([§5](05-transactions.md), [§5.7](05-transactions.md#57-bulk-import),
[§6.1](06-categories.md#61-report)), **brokerage accounts** where trades and holdings are
([§7.1](07-investments.md#71-holdings), [§7.2](07-investments.md#72-purchases),
[§7.3](07-investments.md#73-sales)). Neither list ever shows the other kind. Closed accounts are the
one thing both lists still carry, marked and last ([§4.3](04-accounts.md#43-creating-and-editing)).
The Portfolio and Accounts screens are the two that show every account together, and neither of them
filters.

## Security

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| isin | text | Unique. Used to recognise an existing security during trade entry. |
| ticker | text | |
| name | text | |
| type | enum | `Stock` · `Bond` · `Stock ETF` · `Bond ETF` · `ETC`. Five, and each one is a slice of the portfolio breakdown ([§3.1](03-portfolio.md#31-behaviour)). |
| taxRate | fraction | Capital-gains rate this instrument would be taxed at, **stored 0 – 1 and shown as a percentage** ([§11](11-calculations.md)): `0,26` reads 26%. Used only by [§11.3](11-calculations.md#113-hypothetical-liquidation). Defaults to `defaultTaxRate` ([§10](10-settings.md)); `0,125` on a whitelist government bond. |
| notes | text | |

A security belongs to no institution — it is the same instrument everywhere. The *holding* belongs
to one, through its account, so the same security held at two institutions produces two holdings.

**The tax rate is per security, not per type.** Two securities of one type may carry two rates. The
rate is a fact about the instrument, filled in once when the security is created and rarely touched
again; `type` groups the portfolio into slices ([§3.1](03-portfolio.md#31-behaviour)) and nothing
else.

## Price

| Field | Type | Notes |
| --- | --- | --- |
| securityId + date | key | **One price per security per day.** |
| value | decimal(4) | Positive. |
| source | enum | `manual` · `fetched` |

**Every day is kept; a day is overwritten.** Recording a price for a date that already has one
replaces that value. Prices for other days are never touched, and that history is what makes the
net worth chart possible ([§11.5](11-calculations.md#115-net-worth-over-time)).

## Transaction

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| accountId | ref | Never a `Brokerage` account. |
| date | date | **Never in the future** ([§13](13-validation.md)). |
| description | text | As exported by the bank. |
| amount | amount | Signed. Negative is money out. |
| categoryId | ref? | Empty is legal and reported by check 2. |
| categorySource | enum | `automatic` · `manual`. Never empty. Reversible — see [§5.4](05-transactions.md#54-editing). |
| receiptState | enum | `pending` · `checked` · `na`. **Set by hand and by nothing else.** It defaults to `na` on the add-transaction form, which is the one place it can be given a value as the row is created ([§5.5](05-transactions.md#55-add-transaction)); a row arriving any other way — imported, duplicated — is created `na` and moved afterwards ([§6.3](06-categories.md#63-category-list)). |
| notes | text | User-owned. Never written by the application. |
| insertionSeq | int | Monotonic **per entity** — transactions and trades count separately, and neither ever reuses a value. Second sort key ([§5.2](05-transactions.md#52-ordering-and-paging)). |

`categorySource` is **always one of the two values**. `automatic` means the category is whatever the
rule list currently produces, which may be nothing — a transaction no rule matches is `automatic`
with an empty `categoryId`, and stays that way until a rule matches it or the user sets a category
by hand. `manual` means the user chose it and no automatic pass may overwrite it.

**That is an invariant on the file, not a pass run on request.** The stored `categoryId` of an
`automatic` transaction is never allowed to disagree with what **the rule list as the file holds it**
would produce, so it is recomputed the moment either side of that equation moves: when a transaction
is created or imported, when its description is edited, when a row is switched back to `automatic`
([§5.4](05-transactions.md#54-editing)), when a changed rule list is applied
([§6.2](06-categories.md#62-rules)), and **when a file written by an older version is upgraded** —
the upgrade restores the invariant before the file opens ([§12](12-storage.md)). There is no state
in which the file holds an automatic category no rule would assign.

**A rule list being edited is not yet the rule list.** Rules are changed in an editing session that
writes nothing until it is applied, and the application writes the new rules and the categories they
produce in the same step ([§6.2](06-categories.md#62-rules)). The invariant is never suspended: what
a draft on screen would produce is a preview, and the file goes from one consistent state to the
next without passing through a third.

## Trade

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| kind | enum | `purchase` · `sale` |
| securityId | ref | |
| accountId | ref | **Always a `Brokerage` account.** The cash moved separately, through a transaction on a cash account at the same institution. |
| date | date | **Never in the future** ([§13](13-validation.md)). |
| quantity | decimal(4) | Always positive; `kind` carries direction. |
| unitPrice | decimal(4) | |
| fees | amount | Actually charged, per trade. |
| taxes | amount | Capital-gains tax actually withheld. Sales only; always 0 on a purchase. |
| notes | text | |
| insertionSeq | int | Monotonic among trades. |
| *total* | *amount* | purchase: qty × price + fees · sale: qty × price − taxes − fees |

**A trade never generates a transaction, and a transaction never generates a trade.** Both are
recorded independently; [§9](09-checks.md) compares them.

**A sale carries the tax the broker actually withheld.** Under the Italian *regime amministrato* the
broker withholds the tax at the moment of the sale, so the amount that reaches the account is
already net of it. It is entered from the trade confirmation, never computed.

## Contract

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| name | text | Employer. |
| monthsPerYear | int | 13 today. 14 exists in other contracts. |
| hoursPerDay | decimal(2) | 8 today. |
| startDate / endDate | date / date? | |
| notes | text | |

## ContractYear

| Field | Type | Notes |
| --- | --- | --- |
| contractId + year | key | |
| workingDays | int | Entered by hand. Always the **whole calendar year**, never a year-to-date figure. Only input to hourly pay besides the payslips. |

## Payslip

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| contractId | ref | |
| year, month | int, int | The month the pay is **for**, as printed on the payslip — not necessarily the month it was paid. **Not unique:** a month may hold more than one payslip. |
| label | text? | “13th” for the tredicesima. |
| contractGross | amount | Contractual monthly gross at that date. |
| gross | amount | Actual gross for the month. |
| netPayment | amount | What reached the bank. The figure check 4 uses. |
| refunds | amount | Positive. |
| carPayment | amount | Positive; withheld from the payment. |
| employeeContribution | amount | The employee share credited to the pension fund for that month, as printed on the payslip. Positive; **0 where the payslip has nothing under that heading**. |
| employerContribution | amount | The employer share, on the same terms. |
| severanceContribution | amount | The TFR credited to the fund, on the same terms. |
| notes | text | |
| *netSalary* | *amount* | netPayment − refunds + carPayment |
| *netGrossPct* | *fraction* | netSalary ÷ gross — a fraction, shown as a percentage ([§11](11-calculations.md)) |

**The three pension figures are recorded separately because they reach the fund separately.**
Employee share, employer share and TFR are three credits on the fund's statement, so the payslip
carries three figures and check 5 pairs each one against its own transaction, exactly as check 4
pairs `netPayment` ([§11.6](11-calculations.md#116-derived-matching)). **A figure of 0 expects no
credit and is not paired.**

**A payslip for month M is often paid in month M+1.** There is no payment-date field. Checks 4 and 5
therefore look for their counterpart in month M *or* M+1
([§11.6](11-calculations.md#116-derived-matching)).

## Category

| Field | Type | Notes |
| --- | --- | --- |
| id | id | Stable. Referenced by every transaction and never reused. |
| name | text | |
| type | enum | `Income` · `Expense` · `Investment` · `Divestment` · `Internal` · `Revaluation`. Drives the grouping in [§6.1](06-categories.md#61-report), where `Income`, `Expense` and `Internal` are a group each and the other three share one. |
| role | enum? | `salary` · `pension contribution` · `securities purchase` · `securities sale` · `internal transfer` · `value adjustment` · `bank fees` · `wealth tax` · `interest and dividends`. **Nullable, and empty on most categories** — an empty role means no check and no card cares about this category. **What the checks and the Portfolio all-time card key off** — never a name. |
| receiptTracked | bool | Its transactions are expected to carry a receipt state other than `na` — check 13. |
| order | int | Global display order, **used by the report and by nothing else** ([§6.1](06-categories.md#61-report)): it fixes the row order inside each of the report's four groups, and the numbering runs down the report's own reading order so the whole table ascends in it. Nothing anywhere sorts categories by their amounts. **Every other list of categories is alphabetical by name** — the category list tab, every picker and every filter ([§6.3](06-categories.md#63-category-list)). |

**Categories are stored, but not editable in v1.** The application seeds the list of
[§6.3](06-categories.md#63-category-list) into every new file and offers no way to add, rename or
remove one — that remains a code change ([§15](15-out-of-scope.md)).

## Rule

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| order | int | First match wins. Reorderable by drag. |
| substring | text | Matched case- and accent-insensitively against description only. |
| categoryId | ref | |

Rules are global. They are not scoped to an account.

## Holding — derived, never stored

| Field | Derivation |
| --- | --- |
| key | (securityId, accountId) — the account is always a `Brokerage` one. No holding is derived at all when the running quantity ever went below 0, however the walk ends |
| purchasedQuantity | Σ purchases, carrying the **lot count** — how many purchase trades it came from |
| soldQuantity | Σ sales |
| quantity | purchasedQuantity − soldQuantity |
| avgCost | Weighted average, [§11.1](11-calculations.md#111-weighted-average-cost) |
| invested | quantity × avgCost |
| price, priceDate | The Price record with the latest date for the security. **No Price record at all: price is 0** and check 3 fails ([§11.3](11-calculations.md#113-hypothetical-liquidation)) |
| marketValue | quantity × price |
| gain | marketValue − invested |
| gainPct | gain ÷ invested |
| netProceeds, netGain | marketValue and gain after the hypothetical tax and sell fee of [§11.3](11-calculations.md#113-hypothetical-liquidation) |
| netGainPct | netGain ÷ invested |

A holding exists while its quantity is greater than 0 **and its running quantity has never gone
below 0** at any point in the walk of [§11.1](11-calculations.md#111-weighted-average-cost). It is
never edited; it changes only by recording a trade.

**A running quantity that has gone below 0 produces no holding and no figures.** The row is absent
from [§7.1](07-investments.md#71-holdings) and checks 8 and 9 name the trade that did it
([§9](09-checks.md)). **A dip disqualifies the position, not merely the moment it happened in**: a
walk that went below zero and was brought back above it by a later purchase yields no holding
either. The position stays underived until the trades are corrected.

**All three quantities are kept, and all three are shown** ([§7.1](07-investments.md#71-holdings)).
The table column is the net `quantity`; `purchasedQuantity` and `soldQuantity` sit in the detail
panel beside it.

---

## Why it is this way

- **The cash/brokerage split is enforced out to every picker and filter** because offering the wrong
  kind of account could only produce an empty result or a record that cannot exist. Closed accounts
  are the exception both lists keep, since their rows stay editable
  ([§4.3](04-accounts.md#43-creating-and-editing)).
- **The tax rate sits on the security rather than on its type** because `Bond` settles nothing: a BTP
  is on the whitelist that earns the reduced Italian rate and a corporate bond beside it in the same
  portfolio is not. Putting the rate on the instrument leaves `type` to do the one job it is good at,
  which is grouping the portfolio into slices a person recognises.
- **A day's price is overwritten rather than versioned** so that the last word on a day wins and
  correcting a typo does not leave a second record to disambiguate.
- **The category invariant is what lets every total read the stored value** instead of re-deriving it
  behind each figure ([§6.1](06-categories.md#61-report), [§9](09-checks.md)). An upgrade is included
  in the list of moments that restore it because a new version may seed a category the old one did
  not have or change what an existing one means, and the invariant would otherwise hold for every
  file except the ones just upgraded ([§12](12-storage.md)).
- **Recording the tax withheld on a sale** is what lets the sale's `total` equal the bank transaction
  it is compared against in check 7, and what makes realised gain a real figure rather than a pre-tax
  one. The hypothetical rate of [§11.3](11-calculations.md#113-hypothetical-liquidation) is an
  estimate and has no bearing on a sale that actually happened.
- **A payslip carries no payment date** because the bank transaction already carries the real date,
  and duplicating it here would create a second figure to keep in step. **The three parts of a
  pension contribution are three fields rather than one** because that is how the money moves: the
  fund credits them separately, so recording them separately lets check 5 pair each figure with the
  credit that carries it, on exactly the shape check 4 already uses. One combined figure would have
  forced a comparison of monthly totals instead, in which two adjacent months' windows overlap and
  compete for the same credit.
- **Categories are records rather than constants** for two reasons. Transactions reference a stable
  `id`, so the migration script and the file format have something durable to point at; and every
  check that concerns a particular kind of money keys off `role` rather than off a name, so nothing
  breaks when a label is reworded and a future version can add, say, a second salary-like category
  without touching [§9](09-checks.md).
- **An oversold position is not valued at all** because more sold than was ever bought is not a
  position that can be valued — there is no meaningful average cost, no invested total and no gain to
  derive from it. It is an anomaly and not a stage of ordinary work: the usual causes are a purchase
  that was never entered and a date that was mistyped.
- **A dip disqualifies the position even after a recovery** because the sale drew the cost basis down
  by more than was in it, and no later purchase puts that back
  ([§11.1](11-calculations.md#111-weighted-average-cost)). 50 bought, 100 sold and 200 bought later
  ends at a quantity of 150, which is positive and still wrong by an amount nothing on the screen
  would reveal. Presenting an impossible position in the tables would mean inventing a reading for
  every figure on the screen, in the service of a state whose only correct next step is to fix it
  ([§15](15-out-of-scope.md)).
- **All three quantities are shown** because `quantity` is a difference and a difference forgets: 338
  bought and none sold and 900 bought and 562 sold are the same position and not the same history,
  and the second is the one where the weighted average is worth reading twice.

---

[← §1 Premise and constraints](01-premise-and-constraints.md) · [§3 Portfolio →](03-portfolio.md)
