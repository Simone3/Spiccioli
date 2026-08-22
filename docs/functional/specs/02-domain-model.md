# §2 — Domain model

*[Index](../README.md) · [why it is this way](../why/02-domain-model.md)*

Eleven stored entities and one derived one. *Italic* marks a derived field.

**No `id` is ever shown.** It is how one record points at another and it has no other job: no table has a column for one, no form asks for one, and nothing the user reads or types anywhere in the application is an id. Where these pages say a screen shows “the stored fields”, `id` is the one they never mean ([§4.1](04-accounts.md#41-accounts)).

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
| institutionId | ref? | **Required on every type but `Cash`, where the field is disabled and the value always empty** ([§13](13-validation.md)). Every other type is money held *by* somebody; `Cash` is the one that is held by nobody. |
| type | enum | `Current account` · `Cash` · `Brokerage cash` · `Deposit account` · `Term deposit` · `Pension fund` · `Voucher` · `Brokerage` |
| openingBalance | amount | Default 0. For accounts whose history starts mid-life. Always 0 on a `Brokerage` account. **On a `Pension fund` it counts wholly towards `contributions` below**, which overstates the exit tax where part of it was really revaluation — a known approximation with a direction ([§11.3](11-calculations.md#113-hypothetical-liquidation)). |
| exitTaxRate | fraction? | **Only on a `Pension fund` account**; empty and disabled on every other type ([§13](13-validation.md)). The rate the fund's payout would be taxed at, **stored 0 – 1 and shown as a percentage** ([§11](11-calculations.md)): `0,15` reads 15%. Used only by [§11.3](11-calculations.md#113-hypothetical-liquidation). |
| openingDate | date | Records dated before it are reported by check 12, never prevented. |
| closingDate | date? | Empty means open. An account is closed by editing it and setting this date; there is no other retirement mechanism. |
| notes | text | |
| *status* | *enum* | `closed` when `closingDate` is set, `open` otherwise. A closed account keeps its history **and keeps its balance in every total** ([§11.4](11-calculations.md#114-balances-and-net-worth)); closing marks it and sorts it last, it does not take it out of the arithmetic. |
| *contributions* | *amount* | `Pension fund` only: openingBalance + Σ amounts of its transactions **outside** a `value adjustment` category — the money paid in. |
| *revaluation* | *amount* | `Pension fund` only: Σ amounts of its transactions **in** a `value adjustment` category — what the fund's own investments did. `contributions + revaluation` is the gross balance. |
| *balance* | *amount* | Cash accounts: openingBalance + Σ transaction amounts. **A `Pension fund` account then has its hypothetical exit tax subtracted**, per [§11.3](11-calculations.md#113-hypothetical-liquidation). Brokerage: Σ holding `netProceeds` — net of the hypothetical tax and sell fee of [§11.3](11-calculations.md#113-hypothetical-liquidation), per [§11.4](11-calculations.md#114-balances-and-net-worth). |

**Cash and securities never live in the same account.** The seven cash types hold transactions and no holdings; `Brokerage` holds holdings and no transactions. A broker is therefore two accounts — a `Brokerage cash` one for the money, a `Brokerage` one for the securities — and the money leaving the first to fund a purchase is what check 6 pairs against the trade recorded in the second ([§11.6](11-calculations.md#116-derived-matching)).

**Three of the seven cash types are ordinary money, and what separates them is where the money sits rather than what it does.** A `Current account` is a bank's *conto corrente*, the account a salary lands in and the bills leave from. A `Brokerage cash` account is the cash leg at a broker — the wire in, the fees out, and the uninvested balance waiting for the next purchase — and it is a cash account despite its name, on the cash side of every rule below. `Cash` is money in a wallet. **Nothing is derived from which of the three an account is.** What the split buys is a slice each in the breakdown of [§3.1](03-portfolio.md#31-behaviour), a name on the account that funds a trade, and one field made certain: **`Cash` is the only type that has no institution, and the form disables the field rather than merely allowing it to be empty** ([§13](13-validation.md)).

**Two of the eight types are valued as if they had been realised, and the other six at their face balance.** A `Brokerage` account is worth what its holdings would leave you with after the sell fee and the capital-gains tax, and a `Pension fund` account is worth its balance after the tax its payout would carry ([§11.3](11-calculations.md#113-hypothetical-liquidation)). `Current account`, `Cash`, `Brokerage cash`, `Deposit account`, `Term deposit` and `Voucher` are money that is already money and carry no haircut at all. That is why a pension fund is the one cash type whose transactions are split two ways: **what was paid in is what a payout is taxed on, and what the fund's own investments earned has been taxed inside the fund already** ([§11.3](11-calculations.md#113-hypothetical-liquidation)).

**The split runs all the way out to every account list in the application.** Anywhere accounts are offered — a form's picker, a screen's filter — the list holds only the kind that screen can contain: **cash accounts** where transactions are created, edited, imported, filtered or reported ([§5](05-transactions.md), [§5.7](05-transactions.md#57-bulk-import), [§6.1](06-categories.md#61-report)), **brokerage accounts** where trades and holdings are ([§7.1](07-investments.md#71-holdings), [§7.2](07-investments.md#72-purchases), [§7.3](07-investments.md#73-sales)). Neither list ever shows the other kind. Closed accounts are the one thing both lists still carry, marked and last ([§4.3](04-accounts.md#43-creating-and-editing)). The Portfolio and Accounts screens are the two that show every account together, and neither of them filters.

## Security

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| isin | text | Unique. Used to recognise an existing security during trade entry. |
| ticker | text | **The code the security's `exchange` lists it under** — `SWDA` on Milan, `EUNL` on XETRA — and not a label of the user's choosing, because `ticker` and `exchange` together are what *Update prices* asks the provider for ([§7.6](07-investments.md#76-prices)). It is also the ordering key of both Investments tabs ([§7.1](07-investments.md#71-holdings), [§7.4](07-investments.md#74-securities)). |
| exchange | enum | Where the security is listed. `Milan` · `XETRA` · `Frankfurt` · `Amsterdam` · `Paris` · `Brussels` · `Lisbon` · `Madrid` · `Vienna` · `Helsinki` · `Dublin` · `Athens` · `Stuttgart` · `Düsseldorf` · `Munich` · `Hamburg` · `Tallinn` · `Vilnius`. **Eurozone only, and that is the point**: every amount in the file is EUR ([§1](01-premise-and-constraints.md)), so a listing quoted in anything else is one this application has nowhere to record. It closes the same door [§7.6](07-investments.md#76-prices)'s currency check closes, one step earlier — the check stays the authority, since a eurozone exchange may still carry the odd line quoted in something else. |
| name | text | |
| type | enum | `Stock` · `Stock ETF` · `Bond ETF` · `ETC`. Four, and each one is a slice of the portfolio breakdown ([§3.1](03-portfolio.md#31-behaviour)). **Individual bonds are not one of them** and are out of scope for v1 ([§15](15-out-of-scope.md)); bond exposure is held through a `Bond ETF`, which is quoted and settled like any other fund. |
| taxRate | fraction | Capital-gains rate this instrument would be taxed at, **stored 0 – 1 and shown as a percentage** ([§11](11-calculations.md)): `0,26` reads 26%. Used only by [§11.3](11-calculations.md#113-hypothetical-liquidation). Defaults to `defaultTaxRate` ([§10](10-settings.md)). A `Bond ETF` holding government paper is the case that is not the default: it carries **a blend of the reduced government rate and the ordinary one**, somewhere between 12,5% and 26% depending on what the fund holds — one number, read off the fund's own tax documentation and typed in. |
| notes | text | |

A security belongs to no institution — it is the same instrument everywhere. The *holding* belongs to one, through its account, so the same security held at two institutions produces two holdings.

**A security is one listing, and it takes two fields to say which.** `isin` says which instrument it is; `exchange` says where it is quoted. **`isin` alone cannot be what the price provider is asked for**, because one ISIN spans listings in more than one currency: `IE00B4L5Y983` is quoted in EUR on Milan, on XETRA and in Amsterdam, and in USD in London. An ISIN handed to a provider therefore comes back as whichever of those the provider happens to prefer, and [§7.6](07-investments.md#76-prices)'s currency check then refuses an entirely ordinary holding. **`ticker` and `exchange` name the one listing whose price belongs to this position**, which is the listing the trade was actually filled on.

**Every security the model admits is exchange-traded**, which is why `exchange` is required and has no *none*. The four `type` values are all listed instruments and individual bonds are out of scope ([§15](15-out-of-scope.md)), so there is no v1 security that lacks a listing. A listing the price provider does not happen to carry is a different matter and needs no field: it is a security with no quote available, which [§7.6](07-investments.md#76-prices) already handles as an ordinary row in the review.

**The tax rate is per security, not per type.** Two securities of one type may carry two rates. The rate is a fact about the instrument, filled in once when the security is created and rarely touched again; `type` groups the portfolio into slices ([§3.1](03-portfolio.md#31-behaviour)) and nothing else.

## Price

| Field | Type | Notes |
| --- | --- | --- |
| securityId + date | key | **One price per security per day.** |
| value | decimal(4) | Positive. |
| source | enum | `manual` · `fetched`. **Says what last wrote this record**, and is shown in the price history of [§7.4](07-investments.md#74-securities) and nowhere else. `fetched` only while the value is one *Update prices* wrote and nobody has touched since ([§7.6](07-investments.md#76-prices)); **every edit a user makes sets it to `manual`**, including an edit to a fetched record's value or its date. Nothing reads it. |

**Every day is kept; a day is overwritten.** Recording a price for a date that already has one replaces that value **and its source**. Prices for other days are never touched, and that history is what makes the net worth chart possible ([§11.5](11-calculations.md#115-net-worth-over-time)).

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

`categorySource` is **always one of the two values**. `automatic` means the category is whatever the rule list currently produces, which may be nothing — a transaction no rule matches is `automatic` with an empty `categoryId`, and stays that way until a rule matches it or the user sets a category by hand. `manual` means the user chose it and no automatic pass may overwrite it.

**That is an invariant on the file, not a pass run on request.** The stored `categoryId` of an `automatic` transaction is never allowed to disagree with what **the rule list as the file holds it** would produce, so it is recomputed the moment either side of that equation moves: when a transaction is created or imported, when its description is edited, when a row is switched back to `automatic` ([§5.4](05-transactions.md#54-editing)), when a changed rule list is applied ([§6.2](06-categories.md#62-rules)), and **when a file written by an older version is upgraded** — the upgrade restores the invariant before the file opens ([§12](12-storage.md)). There is no state in which the file holds an automatic category no rule would assign.

**A rule list being edited is not yet the rule list.** Rules are changed in an editing session that writes nothing until it is applied, and the application writes the new rules and the categories they produce in the same step ([§6.2](06-categories.md#62-rules)). The invariant is never suspended: what a draft on screen would produce is a preview, and the file goes from one consistent state to the next without passing through a third.

## Trade

| Field | Type | Notes |
| --- | --- | --- |
| id | id | |
| kind | enum | `purchase` · `sale` |
| securityId | ref | |
| accountId | ref | **Always a `Brokerage` account.** The cash moved separately, through a transaction on a cash account at the same institution. |
| date | date | **Never in the future** ([§13](13-validation.md)). |
| quantity | decimal(6) | Always positive; `kind` carries direction. **Six decimals, not four**: a broker that sells fractional shares states one to six, and a quantity truncated to four makes the trade total disagree with the bank ([§11.6](11-calculations.md#116-derived-matching)). |
| unitPrice | decimal(4) | |
| fees | amount | Actually charged, per trade. |
| taxes | amount | Capital-gains tax actually withheld. Sales only; always 0 on a purchase. |
| notes | text | |
| insertionSeq | int | Monotonic among trades. |
| *total* | *amount* | purchase: qty × price + fees · sale: qty × price − taxes − fees |

**A trade never generates a transaction, and a transaction never generates a trade.** Both are recorded independently; [§9](09-checks.md) compares them.

**A sale carries the tax the broker actually withheld.** Under the Italian *regime amministrato* the broker withholds the tax at the moment of the sale, so the amount that reaches the account is already net of it. It is entered from the trade confirmation, never computed.

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
| contractGross | amount | Contractual monthly gross at that date — the term, not what the month turned out to be. |
| gross | amount | **The payslip's own *totale lordo* line, copied as printed.** What that line contains is a payroll convention of the employer's and not a definition this application supplies; the consequences are set out in [§11.7](11-calculations.md#117-salary-figures). |
| netPayment | amount | What reached the bank. **Either sign** ([§13](13-validation.md)) — a month whose deductions exceed its earnings is a real payslip, not a typo. The figure check 4 uses. |
| refunds | amount | Expenses reimbursed through the payslip. Positive; a magnitude, and [§11.7](11-calculations.md#117-salary-figures) applies its sign. |
| carPayment | amount | Withheld for the company car. Positive; a magnitude, on the same terms. |
| employeeContribution | amount | The employee share credited to the pension fund for that month, as printed on the payslip. Positive; **0 where the payslip has nothing under that heading**. |
| employerContribution | amount | The employer share, on the same terms. |
| severanceContribution | amount | The TFR credited to the fund, on the same terms. |
| notes | text | |
| *netSalary* | *amount* | netPayment − refunds + carPayment. **The only derived field on a payslip** ([§11.7](11-calculations.md#117-salary-figures)). |

**`gross` is a line copied off a document, not a quantity this application defines.** Every other figure on a payslip here is unambiguous — what reached the bank, what was withheld for the car, what the fund was credited — and each is a single amount with one possible reading. *Totale lordo* is not: what an employer's payroll puts into it varies, and the file records the number without recording its composition. **`netSalary` is therefore defined exactly and `gross` is defined by reference**, which is the one place in this model those two kinds of definition meet — **and nothing is ever computed across the two** ([§11.7](11-calculations.md#117-salary-figures), [§15](15-out-of-scope.md)). Every figure built on `gross` is a sum, a mean or a rate over that one field, so they agree with each other whatever the line contains.

**`severanceContribution` is the TFR that reached the *fund*, and the model assumes that is all of it.** An employee who leaves some or all of their severance accruing with the employer instead has an asset that grows every month, is revalued by statute, and **has nowhere in this file to live**: no account holds it, no payslip field records it, and net worth does not know about it ([§15](15-out-of-scope.md)). Where the payslip's TFR line is the credit into the fund, as it is here, the figure is complete and nothing is missing.

**The three pension figures are recorded separately because they reach the fund separately.** Employee share, employer share and TFR are three credits on the fund's statement, so the payslip carries three figures and check 5 pairs each one against its own transaction, exactly as check 4 pairs `netPayment` ([§11.6](11-calculations.md#116-derived-matching)). **A figure of 0 expects no credit and is not paired.**

**A payslip for month M is often paid in month M+1.** There is no payment-date field. Checks 4 and 5 therefore look for their counterpart in month M *or* M+1 ([§11.6](11-calculations.md#116-derived-matching)).

## Category

| Field | Type | Notes |
| --- | --- | --- |
| id | id | Stable. Referenced by every transaction and never reused. |
| name | text | |
| type | enum | `Income` · `Expense` · `Investment` · `Divestment` · `Internal` · `Revaluation`. Drives the grouping in [§6.1](06-categories.md#61-report), where `Income`, `Expense` and `Internal` are a group each and the other three share one. |
| role | enum? | `salary` · `pension contribution` · `securities purchase` · `securities sale` · `internal transfer` · `value adjustment` · `bank fees` · `wealth tax` · `interest and dividends`. **Nullable, and empty on most categories** — an empty role means no check and no card cares about this category. **What the checks and the Portfolio *gains and costs* card key off** — never a name. |
| receiptTracked | bool | Its transactions are expected to carry a receipt state other than `na` — check 13. |
| order | int | Global display order, **used by the report and by nothing else** ([§6.1](06-categories.md#61-report)): it fixes the row order inside each of the report's four groups, and the numbering runs down the report's own reading order so the whole table ascends in it. Nothing anywhere sorts categories by their amounts. **Every other list of categories is alphabetical by name** — the category list tab, every picker and every filter ([§6.3](06-categories.md#63-category-list)). |

**Categories are stored, but not editable in v1.** The application seeds the list of [§6.3](06-categories.md#63-category-list) into every new file and offers no way to add, rename or remove one — that remains a code change ([§15](15-out-of-scope.md)).

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

A holding exists while its quantity is greater than 0 **and its running quantity has never gone below 0** at any point in the walk of [§11.1](11-calculations.md#111-weighted-average-cost). It is never edited; it changes only by recording a trade.

**A running quantity that has gone below 0 produces no holding and no figures.** The row is absent from [§7.1](07-investments.md#71-holdings) and checks 8 and 9 name the trade that did it ([§9](09-checks.md)). **A dip disqualifies the position, not merely the moment it happened in**: a walk that went below zero and was brought back above it by a later purchase yields no holding either. The position stays underived until the trades are corrected.

**All three quantities are kept, and all three are shown** ([§7.1](07-investments.md#71-holdings)), all three in the detail panel: the net `quantity` first, then `purchasedQuantity` with the lots it came from and `soldQuantity` beside it. The table itself carries no quantity — it states what a position is worth, not what it is made of.

---

[← §1 Premise and constraints](01-premise-and-constraints.md) · [§3 Portfolio →](03-portfolio.md)
