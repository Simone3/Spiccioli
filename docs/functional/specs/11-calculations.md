# §11 — Calculations

*[Index](../README.md) · no mockups for this section*

Every formula in one place. **All amounts are EUR and every monetary figure is printed with `€`
before it** — fixed, not a preference ([§1](01-premise-and-constraints.md),
[§10](10-settings.md)). Rounding is to 2 decimals at display, never in intermediate steps. **Every
monetary figure carries exactly two decimals** — single amounts, column totals, yearly aggregates,
hourly rates — so a round thousand reads `€ 21.900,00` and never `€ 21.900`, and a column of figures
always aligns on the same decimal place. Quantities and unit prices carry four; percentages carry
one. The only figures written short are the axis labels on a chart, where `100k` is the point.

**A percentage is stored as a fraction and displayed as a percentage.** `taxRate`, `defaultTaxRate`,
`netGrossPct`, `gainPct` and `netGainPct` all hold a number between 0 and 1 — 26% is `0,26` and
12,5% is `0,125` — and the × 100 happens once, at display. Every formula in this section therefore
applies a rate by multiplying: `taxableGain × security.taxRate` is the tax, not a hundred times it.
A field that is *entered* as a percentage says so where it is defined ([§13](13-validation.md));
what is stored underneath it is the fraction.

**There are exactly two exceptions to the no-intermediate-rounding rule, and both round to the
cent:**

1. The amount comparisons of [§11.6](#116-derived-matching) are made on totals rounded to 2
   decimals.
2. The hypothetical tax of [§11.3](#113-hypothetical-liquidation) is rounded before it is
   subtracted.

Nothing else rounds until it is displayed.

**“Today” is the computer's own clock** — its current local date, read at the moment a figure is
computed and never cached. Every age in the application rests on it: the staleness of a price, the
months since a pension revaluation, how long a receipt has been pending. Checks run at startup and
after every change ([§9](09-checks.md)), so a session left open across midnight goes on reporting
yesterday's ages until something changes or the application is restarted. **There is no timer and no
midnight refresh.**

**A formula that cannot be evaluated produces *undefined*, not zero and not blank.** That covers a
division by zero — hourly pay for a year whose working days were never entered, a net-to-gross ratio
on a gross of zero, a percentage gain on a position that cost nothing — and equally a formula one of
whose inputs does not exist, which is the realised gain on a sale in a position that has no average
cost ([§11.2](#112-realised-gain-on-a-sale)). Each reads `undefined` where the figure would go, and
whatever would make it computable is left visibly empty or is named by a check
([§8.1](08-salaries.md#81-payslips), [§9](09-checks.md), [§13](13-validation.md)).

**A total made of figures that may be undefined states what it left out.** It sums the ones that
exist and says how many it could not — never treating an undefined figure as zero, and never
refusing to produce a total because one row is broken.

**Every formula here assumes a file whose checks pass.** Where one does not, the figures downstream
of what the check names may be undefined, wrong, or in disagreement with one another, and that is
the reported state rather than a case to be handled ([§9](09-checks.md)).

---

## 11.1 Weighted average cost

- Per (security, account), walking trades from `quantity = 0`, `costBasis = 0` and an `avgCost` that
  is undefined until the first purchase gives it one.
- **The walk order is `date ASC, purchases before sales, insertionSeq ASC, id ASC`** — a total order,
  so the walk reaches the same result on every machine and after every re-sort. It is the ordering of
  the Purchases and Sales tables ([§7.2](07-investments.md#72-purchases)) with one key inserted,
  because those two tables never hold a purchase and a sale at once and this walk does.
- **Purchases come first on a date they share with a sale**, so a security bought and sold on one day
  is an ordinary round trip and not a position that dipped below zero. Nothing else in this section
  is sensitive to the order of two trades on one day; that one case is, and it decides whether the
  position is derived at all. It is also what lets check 9 count a same-day purchase
  ([§9](09-checks.md)).
- **Purchase:** `quantity += q`, `costBasis += q × price + fees`, `avgCost = costBasis ÷ quantity`.
- **Sale:** `quantity −= q`, `costBasis −= q × avgCost`. **`avgCost` is unchanged by a sale.**
- Fees increase the cost basis on purchase and reduce proceeds on sale. **Taxes withheld on a sale
  never touch the cost basis** — they leave the proceeds, not the position.
- **A sale that takes quantity to exactly 0 sets `costBasis` to 0 and clears `avgCost`.**
- **A sale that takes quantity below 0 ends the walk.** No holding is derived for that (security,
  account) and no average cost, invested total, gain or valuation is computed from it, **whatever the
  walk ends at** ([§2](02-domain-model.md)) — checks 8 and 9 name the trade instead
  ([§9](09-checks.md)).

## 11.2 Realised gain on a sale

- `netProceeds = q × price − taxes − fees` — the trade's `total`, and the figure compared against
  the bank transaction by check 7.
- `realisedGain = netProceeds − (q × avgCost at the time of the sale)`. Net of everything the broker
  took, so it is what the sale actually added to net worth.
- **It is *undefined* when there is no `avgCost` to subtract.** The walk of
  [§11.1](#111-weighted-average-cost) ends the moment a (security, account) goes below zero, so every
  sale in such a position — the one that broke it and any recorded after it — has no cost basis
  behind it and no realised gain ([§2](02-domain-model.md)). The figure reads `undefined` on the
  Sales tab ([§7.3](07-investments.md#73-sales)) by the general rule of [§11](#11--calculations), and
  **the totals that sum realised gain — the Sales footer and the Portfolio all-time card — sum the
  sales that have one and state how many they left out**
  ([§3.1](03-portfolio.md#31-behaviour)).
- Summed across all sales that have a defined figure, for the Portfolio all-time card.
- The gross counterpart, `q × price − fees − (q × avgCost)`, is what the tax was computed on — the
  same shape as `taxableGain` in [§11.3](#113-hypothetical-liquidation), fee first. **It is not
  displayed.**

## 11.3 Hypothetical liquidation

- `grossProceeds = quantity × price`, where `price` is the value of the security's latest Price
  record, **or 0 when it has none**.
- **A holding with no price is worth 0**, its gain is minus its cost, its tax is 0 and **no sell fee
  is charged**. Check 3 names the security, and [§7.1](07-investments.md#71-holdings) marks the row.
- `fee = institution.defaultSellFee` of the holding's account, which always has one: a `Brokerage`
  account cannot exist without an institution ([§13](13-validation.md)), so the fee is always
  defined, though it may well be zero. **Charged once per holding**, so liquidating three positions
  at one broker is estimated with three fees.
- `taxableGain = grossProceeds − fee − (quantity × avgCost)`
- `tax = taxableGain > 0 ? round(taxableGain × security.taxRate) : 0` — **never negative**; a loss
  produces no rebate.
- `netProceeds = grossProceeds − fee − tax`
- `netGain = netProceeds − (quantity × avgCost)`
- `netGainPct = netGain ÷ (quantity × avgCost)` — the net counterpart of the holding's gross
  `gainPct` ([§2](02-domain-model.md)), shown beside `netGain` in the detail panel of
  [§7.1](07-investments.md#71-holdings) and *undefined* on a position that cost nothing.
- **The fee comes out before the tax, not after it.** A selling commission reduces the gain the tax
  is computed on.
- **Tax is rounded to the cent** before it is subtracted — the second of the two places a figure is
  rounded mid-calculation ([§11](#11--calculations)), the other being the amount comparison of
  [§11.6](#116-derived-matching).
- **netProceeds can be negative, and that is correct.** A position worth less than the fee to sell
  it would cost money to close, and net worth says so. The fee is charged whatever the position is
  worth. The one holding valued at exactly zero is the one with no price at all, above, where no fee
  is charged because nothing is being sold.
- The portfolio-level figure is the sum across all holdings, each with its own institution fee and
  tax rate. It is the *unrealised net investment gain* line on Portfolio, and, added to the
  cost-based total, the headline net worth itself ([§3.1](03-portfolio.md#31-behaviour)).
- **Applies only to open holdings.** A sale that has happened carries the tax the broker actually
  withheld ([§2](02-domain-model.md), [§11.2](#112-realised-gain-on-a-sale)); this section never
  restates it.
- **Tax appears in exactly two places in the application** — the hypothetical figure above, and the
  amount recorded on a sale ([§11.2](#112-realised-gain-on-a-sale)) — and **only the Italian regime
  is implemented** ([§15](15-out-of-scope.md)). The shape is the smallest that can hold another one:
  the rate is a field on the security ([§2](02-domain-model.md)) rather than a constant, and the gain
  it applies to is computed separately from the rate applied to it. Whitelist government bonds
  already exercise that at 12,5%. **Anything a different regime needs beyond a rate per instrument**
  — holding-period relief, loss carry-forward, a personal allowance — **is a change to this section
  and to no other**, and none of it is designed for now.

> Weighted average is an approximation. A broker may match lots differently when computing the
> taxable gain, so the tax figure is an estimate. **The application must say so wherever the figure
> appears.**

## 11.4 Balances and net worth

- Cash account: `accountBalance = openingBalance + Σ transaction amounts`
- Brokerage account: `accountBalance = Σ netProceeds of its holdings`
  ([§11.3](#113-hypothetical-liquidation))
- `netWorth = Σ accountBalance` over **every account** — which, holdings being held in accounts of
  their own, is the whole of it.
- `totalAtCost = Σ cash accountBalance + Σ holding invested`, over the same accounts: the same total
  with holdings at cost. `netWorth − totalAtCost` is the unrealised net gain, and the two are the
  decomposition shown on Portfolio ([§3.1](03-portfolio.md#31-behaviour)). **The two sums must run
  over the same set of accounts**, and that set is simply *all of them*.
- Securities purchases already reduce the cash account through their transaction, so holdings are
  added, not double-counted.
- **Closed accounts are included, exactly like open ones.** **Check 11 is what reports a closed
  account that is not empty**, naming it and the balance left in it, and the Portfolio banner carries
  that until the account is emptied or its closing date removed.

## 11.5 Net worth over time

- Monthly points at each month end, from **the month the file starts in** up to the last month end
  before today — **plus one final point at today itself**, which is the only point not on a month
  end. **On a day that is itself a month end there is one point, not two.**
- **The file starts at the earliest of any account's `openingDate`, any transaction's date and any
  trade's date** — not at the earliest transaction.
- At date `d`, over every account whose `openingDate ≤ d` — **closed ones included, on the same rule
  as [§11.4](#114-balances-and-net-worth)**:
  `Σ (openingBalance + Σ transactions ≤ d)` plus, per holding in those accounts, that holding's
  **net proceeds at `d`** — `quantity(d) × price`, less the institution's sell fee and the tax on the
  gain over `avgCost(d)`, by the arithmetic of [§11.3](#113-hypothetical-liquidation) — where price
  is the **most recent Price record dated ≤ d**. An account contributes nothing before it existed.
- **The line is net worth, the same quantity as the headline above it**, computed at each date
  instead of only at today's. The final point therefore *is* the headline figure, to the cent.
- **The rate and the fee applied at every point are today's**, because they are the only ones the
  file records — a security carries one `taxRate` and an institution one `defaultSellFee`, with no
  history behind either ([§2](02-domain-model.md)). A past point is therefore what that portfolio
  would have been worth in hand *on today's terms*, not what it would have fetched at the time.
- **A position that has ever gone oversold contributes nothing at any point on the line**, early ones
  included, because no holding is derived for it at all ([§2](02-domain-model.md),
  [§11.1](#111-weighted-average-cost)). The line is therefore wrong by whatever that position was
  worth in the years before the trade that broke it, and no attempt is made to draw those years from
  the trades that were fine. Checks 8 and 9 are failing while this is true ([§9](09-checks.md)).
- **The fallback to cost covers the years before a price was recorded, and nothing else.** A holding
  whose security has at least one Price record but none dated ≤ `d` contributes **its cost** —
  `quantity(d) × avgCost(d)`, with no sell fee and no tax. A holding whose security has **no Price
  record at all** contributes **zero**, exactly as it does everywhere else
  ([§11.3](#113-hypothetical-liquidation)); check 3 names it.
- **That distinction is what makes the final point the headline figure.** A price is never dated in
  the future ([§13](13-validation.md)), so at `d` = today every security that has any price has one
  dated ≤ today, and nothing can fall back to cost there. The last point is therefore
  [§11.4](#114-balances-and-net-worth) evaluated at today, by the same arithmetic, to the cent — and
  **it is never dashed**.
- **The three dates that could have broken that equality are all barred from the future.** A
  transaction, a trade and a price are each a record of something that has happened
  ([§13](13-validation.md)), so at `d` = today `Σ transactions ≤ d` is *every* transaction,
  `quantity(d)` is the whole of every position, and no price sits beyond the point being drawn —
  which is precisely the set [§11.4](#114-balances-and-net-worth) sums over.
- **The dash is per point, not per stretch:** a month is dashed when *any* holding open in it fell
  back to cost, and solid when every one of them had a price. A dashed point is the only part of the
  line that is not net worth as [§11.4](#114-balances-and-net-worth) computes it.
- **The legend carries the two things that are not obvious from the line**: which stretch was drawn
  from prices and which from cost, and that the tax and the fee taken out at every point are today's
  ones. The final point needs no note at all: it is the figure printed at the top of the screen.

## 11.6 Derived matching

Records that ought to correspond are paired heuristically, with **no linking effort from the user**.
Matching is recomputed, never stored.

**No matcher here compares absolute values.** Amounts are signed ([§2](02-domain-model.md)) and the
sign is part of what is being matched, so every pairing below states whether the two figures are
**equal** or **exactly opposite** and compares them as they stand:

| Pairing | Relation | Because |
| --- | --- | --- |
| Internal transfer legs, check 1 | `a.amount = − b.amount` | One account sends what the other receives. |
| Purchase transaction ↔ purchase trade, check 6 | `transaction.amount = − trade.total` | The money leaves the cash account; the trade total is what it cost, a positive figure. |
| Sale transaction ↔ sale trade, check 7 | `transaction.amount = trade.total` | The money arrives; net proceeds is what arrived. |
| Payslip ↔ salary transaction, check 4 | `transaction.amount = payslip.netPayment` | Pay arrives, and `netPayment` is a magnitude ≥ 0 ([§13](13-validation.md)). |
| Payslip pension figure ↔ pension credit, check 5 | `transaction.amount = the figure` | A credit into the fund, against a magnitude ≥ 0. |

**Every matcher here is greedy, and every one of them states its order.** The pattern is the same in
all four — transfer legs, trades, salary payments and pension credits: the side being matched *from*
is walked in the ordering its own screen uses —
`date ASC, insertionSeq ASC, id ASC` for transactions and trades
([§5.2](05-transactions.md#52-ordering-and-paging), [§7.2](07-investments.md#72-purchases)), month
ascending and unlabelled first for payslips ([§8.1](08-salaries.md#81-payslips)) — and each record
claims the **nearest-dated** unclaimed counterpart that satisfies the conditions, ties broken by
that counterpart's `insertionSeq` and then its `id`. Nothing is left to iteration order.

- **Internal transfer legs:** exactly opposite amounts — `a.amount = − b.amount` — different
  accounts, dates within `transferMatchWindowDays`, both in a category with role `internal transfer`.
  Greedy one-to-one in the order above — legs walked by date, each claiming the nearest-dated
  unclaimed counterpart. Unpaired legs are listed by check 1.
- **Two transfers of the same amount in the same week can have their links crossed.** Moving
  € 500,00 from A to B and € 500,00 from C to D in the same window may pair A with D and C with B.
  Every leg still pairs, check 1 still passes, and the only thing that is wrong is which account the
  *Matched* column names ([§5.1](05-transactions.md#51-columns)). **The ordering rules above are what
  keep it deterministic** — crossed or not, the same file pairs the same way on every machine.
- **The two legs carry the same amount, and a transfer fee is never netted into one of them.** If
  the sending bank takes € 1,00 to make the wire, that euro is **its own transaction** on the
  sending account, in a category with role `bank fees` — never subtracted from the leg.
- **Trades against transactions:** a transaction whose category role is `securities purchase` /
  `securities sale` pairs with a trade of the matching kind when the amount stands in the relation
  above to the trade total — **negated on a purchase, equal on a sale** — dates are within
  `tradeMatchWindowDays`, and **the transaction's account and the trade's brokerage account belong to
  the same institution**. One-to-one, trades walked in their own table order and each claiming the
  nearest-dated unclaimed transaction that qualifies. Unmatched records on either side are listed by
  checks 6 and 7.
- The two sides sit in different accounts by construction — the trade in a brokerage account, the
  money in a cash one — so the pairing keys off the institution they share rather than off the
  account. **The trade side always has one**: a `Brokerage` account cannot be created without an
  institution ([§13](13-validation.md)). The only account that can lack one is a `Liquidity`
  account, and the only such account in practice is physical cash, **which therefore never pairs**.
- **A purchase is funded from the broker's own cash account, and that is a rule about how to record,
  not a preference.** Money wired straight from another bank into a trade has no leg at the
  institution the trade sits in, so nothing can pair it and check 6 fails for as long as it stays
  that way. The way to record it is an **internal transfer** from the other bank into the broker's
  cash account, then the purchase out of that account.
- The trade total is the one from [§2](02-domain-model.md) — `qty × price + fees` on a purchase,
  `qty × price − taxes − fees` on a sale. The comparison is an exact match on the cent-rounded total
  rather than a tolerance.
- **Payslips against transactions:** a payslip pairs with a transaction in a role `salary` category
  whose amount equals its `netPayment` and whose date falls in the payslip's own month or the month
  after. One-to-one, payslips walked by month and then label as
  [§8.1](08-salaries.md#81-payslips) orders them, and each claiming the nearest-dated unclaimed
  transaction that qualifies. **The window is a whole month, not a number of days.** Check 4 reports
  both sides.
- **A payslip has no date, so “nearest” is measured from the first day of its own month**
  ([§2](02-domain-model.md)): the distance ranked is from that month's first day to the transaction's
  date, so among two candidates a payslip takes the earlier one. Ties are broken by the transaction's
  `insertionSeq` and then its `id`, as everywhere else here.
- **The payslips of every contract are walked together, because a transaction has no employer on
  it** ([§2](02-domain-model.md)). The walk covers every contract's payslips in one pass, ordered by
  month and label with the contract's name breaking any remaining tie. Two employers paying an
  identical net amount in the same month can therefore have their two links crossed: both payslips
  pair, both transactions pair, check 4 passes, and the only thing that is wrong is which of two
  identical rows the *Matched* column names.
- **A `netPayment` of zero pairs like any other figure**, against a transaction of `0,00`. Both sides
  are legal amounts ([§13](13-validation.md)) and the ordinary equality finds them. Nothing
  special-cases zero on this path.
- **Pension credits against payslip figures:** each of a payslip's three pension figures —
  `employeeContribution`, `employerContribution`, `severanceContribution` ([§2](02-domain-model.md))
  — pairs with a transaction in a role `pension contribution` category whose amount equals it and
  whose date falls in the payslip's own month or the month after. One-to-one, the figures walked in
  the payslip order of [§8.1](08-salaries.md#81-payslips) and, within one payslip, employee then
  employer then severance, each claiming the nearest-dated unclaimed transaction that qualifies.
  **The window is a whole month, not a number of days**, exactly as for a salary payment. Check 5
  reports both sides.
- **Distance is measured from the first day of the payslip's month** here too, a payslip having no
  date of its own, with ties broken by the transaction's `insertionSeq` and then its `id`. **The
  payslips of every contract are walked together** for the same reason as check 4: a transaction
  carries no employer.
- **A figure of 0 is not a claim.** It expects no credit, takes no part in the walk and cannot be
  reported as unmatched — a heading the payslip has nothing under is not a credit that failed to
  arrive. This is the one place a zero behaves differently from `netPayment` above, and the
  difference is that every payslip has a net payment while most have at least one contribution
  heading standing empty.
- **Two of a payslip's figures being equal costs nothing.** Two claims of € 180,00 against two
  credits of € 180,00 both pair, and the only thing that can be wrong is which of two identical
  credits the *Matched* column names — the same harmless crossing as two transfers of one amount in
  one week.
- **A credit is shown against the payslip whose figure claimed it**, by its month and its label, in
  the *Matched* column ([§5.1](05-transactions.md#51-columns)). A credit no figure claimed reads an
  em dash and is what check 5 lists on the transaction side.

## 11.7 Salary figures

- `netSalary = netPayment − refunds + carPayment`
- `netGrossPct = netSalary ÷ gross`
- `yearContractGross = contractGross of the year's **last** payslip × contract.monthsPerYear`, in
  the ordering of [§8.1](08-salaries.md#81-payslips), and **0 for a year with no payslips**. The
  last one is the terms as they stood at the end of the year, which is what the contract line on the
  totals chart is read against; a year that recorded nothing draws no line rather than an *undefined*
  ([§11](#11--calculations)).
- `yearAvgGross = Σ gross in year ÷ count of payslips in year`, and the same over `netSalary` for
  `yearAvgNet`. **The divisor is the payslips there were**, not twelve and not `monthsPerYear`: a
  year with five payslips averages over five. A year carrying a tredicesima averages over thirteen
  rows, so strictly the figure is the average **payslip** rather than the average calendar month. The
  payslip count in the per-year table is what makes the divisor visible.
- Both feed the averages chart of [§8.1](08-salaries.md#81-payslips) and appear nowhere else. The
  per-year table carries totals and rates.
- `grossPerHour = Σ gross in year ÷ (workingDays × contract.hoursPerDay)`, and the same with
  `Σ netSalary`. `workingDays` is the whole calendar year ([§2](02-domain-model.md)), so a partial
  year understates both — accepted, see [§8.1](08-salaries.md#81-payslips).
- Per-year `netGrossPct = Σ netSalary in year ÷ Σ gross in year`, not the average of the monthly
  percentages.
- All of the above are computed within the selected contract only.

---

## Why it is this way

- **Two decimals everywhere, and only two exceptions to the rounding rule.** Both exceptions sit
  where an amount of money someone else has already rounded to the cent sits on the other side: the
  figure a matched total is compared against is a bank transaction that was itself rounded, and the
  hypothetical tax stands for an amount a broker would withhold in cents — leaving it unrounded would
  make the per-holding net values fail to add up to the portfolio total by a fraction of a cent.
- **Percentages are stored as fractions** so that every formula applies a rate by multiplying, with
  no scaling step to forget.
- **There is no midnight refresh** because for a ledger measuring ages in weeks and months, a day of
  lag on an idle window is not worth a background process.
- **An unevaluable formula reads *undefined*** because zero would be a lie and a dash would look like
  “none recorded”.
- **A sale to exactly zero resets the cost basis** because four-decimal quantities and averages leave
  fractions of a cent behind, and without the reset a later repurchase of the same security in the
  same account would begin from a cost basis of half a cent — small enough never to be noticed and
  wrong from then on.
- **The walk's order is total, and purchases lead on a shared date**, because the alternative was a
  rule that read “date order” and left one case undecided — the case that decides whether the
  position exists at all. Buying 100 and selling 100 on one morning is a round trip; walking the sale
  first turns it into a quantity of −100 and disqualifies the position permanently, along with every
  figure derived from it and the realised gain on every sale in it. Two implementations, or one
  implementation after a re-sort, would have disagreed about a file neither of them had changed.
- **A sale below zero ends the walk** because the arithmetic is defined only while the position is
  non-negative: subtracting `q × avgCost` for more units than the basis holds leaves a cost basis
  that is too low by the difference, and every later purchase carries that error forward rather than
  repairing it. A position that dipped and recovered is as unreadable as one still in deficit, and it
  is the one of the two that would otherwise look perfectly ordinary on screen.
- **An undefined realised gain is left out of totals rather than counted as zero**, because treating
  it as zero would fold a broken position silently into a lifetime figure; leaving the count visible
  points at checks 8 and 9, which name the trade to fix ([§9](09-checks.md)).
- **The gross counterpart of realised gain is not displayed** because the tax on a real sale is a
  recorded fact, so there is nothing to reconcile it against. Its shape matches `taxableGain` — fee
  first — which is why the estimate and the record are comparable at all.
- **An unpriced holding is worth zero rather than worth its cost** because valuing it at cost would
  have buried a missing price inside a number that looks right.
- **The fee comes out before the tax** because that is how the broker computes it, and it is the only
  ordering under which this estimate and the recorded figures of
  [§11.2](#112-realised-gain-on-a-sale) mean the same thing by the same arithmetic. It is worth a
  quarter of the fee, and it is worth being right about.
- **`netGainPct` is the percentage worth quoting about a holding**, because it is the one the tax and
  the fee have been taken out of.
- **A holding whose whole value is a rounding error is worth seeing** rather than flattening to zero:
  a smaller gain does not buy a smaller commission.
- **Room for another tax system was bought cheaply and deliberately**, and it is worth being clear
  what it did and did not cost. Keeping the rate on the instrument rather than in the code costs one
  field that has to be filled in on every security; it is paid for twice over by whitelist government
  bonds, which need a second rate under the *current* regime and are the reason the field is not on
  the type. Computing the gain separately from the rate applied to it costs nothing at all — it is
  how the arithmetic reads best anyway. What was declined is everything past that: no relief, no
  carry-forward, no allowance, and no attempt to guess which of them a future regime would want. A
  parameter that has one use today is a parameter; a mechanism built for a regime nobody has
  specified is a liability with a plausible name.
- **Closed accounts stay in net worth** because a closing date is a label on an account, not a
  subtraction: nothing stops an account being closed with money still in it, since checks report
  rather than block ([§9](09-checks.md)), and an account closed properly was emptied first.
  Excluding them would mean net worth moving by whatever was left behind at the moment a date was
  typed into a form, and it would put the same asterisk on the breakdown, the chart and the accounts
  table. The money is never quietly dropped; it is counted and named.
- **The chart carries a final point at today** because ending on the last completed month would leave
  it short of the headline figure above it by however far into the month it happens to be, and the
  line would appear to stop growing for a few weeks every month. Drawing two points on a day that is
  itself a month end would put a marker on top of a marker to no purpose.
- **The line starts at the earliest of three dates** because opening balances are money that was
  there before the first row was recorded, an account whose whole history is an opening balance has
  no transactions at all, and a file whose investing predates its bank exports would otherwise begin
  after its own first purchase.
- **Today's rate and fee are applied along the whole line** because the alternative was a chart in a
  different unit from the figure above it, and of the two approximations this is the one that makes
  the two numbers on the screen comparable. It is also the same caveat the headline already carries
  ([§11.3](#113-hypothetical-liquidation)) rather than a new one.
- **The fallback wording matters.** Had it been written as “no price is known at `d`” it would have
  fired at today's point too, and the chart would have ended a little above the number printed over
  it on exactly the files where check 3 is already failing. A security with no price at all is not a
  position waiting for its history to begin, it is a position nobody has ever valued.
- **Barring three dates from the future is what keeps the last point equal to the headline.** Allow
  one future-dated row and the two figures on the screen part company: the headline counts it and the
  line cannot, since the line is a function of `d` and the row is not in the past at any `d` on it.
- **The dash is stated per point** so that a security first priced years after it was bought dashes
  the stretch before that instead of quietly passing as measured. In practice that produces a single
  dashed prefix and a solid remainder, because prices start being recorded and then keep being
  recorded. The dashed stretch shows the shape of the years before anyone was recording prices; a
  decade of holdings collapsing to zero would have said something false about the past rather than
  something true about the data.
- **Matching on magnitudes would have been shorter to write** and would have paired a securities
  purchase recorded as money *in*, a transfer whose two legs are both negative and a salary entered
  as a debit — each of them a sign error that the file should be reporting. Comparing the signed
  figures leaves those unpaired, and an unpaired record is named by its check ([§9](09-checks.md)).
- **Every matcher states its order** because a greedy pairing with an unstated order is a pairing
  that can come out differently on two machines reading the same file. The same reasoning fixes an
  anchor inside a payslip's month: any fixed anchor would do, but two implementations picking
  differently would pair the same file two ways. Measuring from the first of the month makes the
  ordinary case — pay on the 27th of the month, or on the 1st of the next — fall out in the order
  anyone would expect.
- **Crossed links cost nothing.** The alternative is a field on every transaction saying which
  transfer or which employer it belongs to, maintained forever against a coincidence with no
  consequence.
- **A transfer fee is split out rather than netted** because netting it would leave € 501,00 out
  against € 500,00 in, which is not a pair by any definition the application could be given, and
  check 1 would report it for as long as the file existed. Splitting it also puts the fee where the
  rest of the year's bank charges are, which is where anyone would look for it.
- **The trade comparison is exact rather than tolerant** because both totals are the figure that
  moved through the account.
- **The salary window is a whole month** because what varies is which month the employer pays in, not
  by how many days it slips.
- **Pension credits are paired one to one because the payslip records them one at a time.** The
  earlier design held a single combined figure and had to compare monthly totals against it, which
  brought two problems that were properties of the totals rather than of the data. A month's window
  overlaps the next month's, so the two compete for the same credit whenever the fund pays in the
  month of the payslip rather than the month after; and any rule for stopping a month short of
  another's credits leaves stray amounts with no month willing to report them. Three figures against
  three credits has neither: every claim is an exact amount, every credit is claimed by at most one
  figure, and anything left over on either side is named by check 5 as itself rather than as a
  difference between two sums. It is also the shape check 4 already uses, so there is one matching
  rule to understand instead of two.
- **A zero contribution takes no part** because a heading with nothing under it is not a credit that
  failed to arrive. `netPayment` is the opposite case — every payslip has one, so a zero there is a
  figure somebody entered and a `0,00` credit is the thing to look for.
- **The salary averages divide by the payslips there were** because that is what makes them the only
  salary figures a partial year does not understate ([§8.1](08-salaries.md#81-payslips)); a
  thirteenth month of pay is pay, and spreading it over twelve would flatter every month by a
  thirteenth. Keeping totals and rates in the per-year table means no figure in the application is an
  average and a total of the same thing sitting two columns apart.
- **`yearContractGross` is 0 rather than *undefined* for an empty year** because the figure is a
  restatement of a contract term and not a division by anything.

---

[← §10 Settings](10-settings.md) · [§12 Storage →](12-storage.md)
