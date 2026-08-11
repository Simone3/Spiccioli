# §11 — Calculations

*[Index](../README.md) · no mockups for this section*

Every formula in one place. All amounts are EUR; rounding is to 2 decimals at display, never in
intermediate steps. **Every monetary figure carries exactly two decimals** — single amounts, column
totals, yearly aggregates, hourly rates — so a round thousand reads `€ 21.900,00` and never
`€ 21.900`, and a column of figures always aligns on the same decimal place. Quantities and unit
prices carry four; percentages carry one. The only figures written short are the axis labels on a
chart, where `100k` is the point. **One exception to the no-intermediate-rounding rule:** the amount
comparisons of [§11.6](#116-derived-matching) are made on totals rounded to 2 decimals, because the
figure on the other side of the comparison is a bank transaction that was itself rounded to the
cent.

**“Today” is the computer's own clock** — its current local date, read at the moment a figure is
computed and never cached. Every age in the application rests on it: the staleness of a price, the
months since a pension revaluation, how long a receipt has been pending. One consequence is worth
stating: checks run at startup and after every change ([§9](09-checks.md)), so a session left open
across midnight goes on reporting yesterday's ages until something changes or the application is
restarted. There is no timer and no midnight refresh — for a ledger measuring ages in weeks and
months, a day of lag on an idle window is not worth a background process.

**A formula that would divide by zero produces *undefined*, not zero and not blank.** Hourly pay for
a year whose working days were never entered, a net-to-gross ratio on a gross of zero, a percentage
gain on a position that cost nothing: each reads `undefined` where the figure would go, and the
input that would make it computable is the one left visibly empty
([§8.1](08-salaries.md#81-payslips), [§13](13-validation.md)). Zero would be a lie and a dash would
look like “none recorded”.

---

## 11.1 Weighted average cost

- Per (security, account), walking trades in date order.
- **Purchase:** `quantity += q`, `costBasis += q × price + fees`, `avgCost = costBasis ÷ quantity`.
- **Sale:** `quantity −= q`, `costBasis −= q × avgCost`. **`avgCost` is unchanged by a sale.**
- Fees increase the cost basis on purchase and reduce proceeds on sale. **Taxes withheld on a sale
  never touch the cost basis** — they leave the proceeds, not the position.
- **A sale that takes quantity to exactly 0 sets `costBasis` to 0 and clears `avgCost`.**
  Four-decimal quantities and averages leave fractions of a cent behind, and without the reset a
  later repurchase of the same security in the same account would begin from a cost basis of half a
  cent — small enough never to be noticed and wrong from then on.

## 11.2 Realised gain on a sale

- `netProceeds = q × price − taxes − fees` — the trade's `total`, and the figure compared against
  the bank transaction by check 7.
- `realisedGain = netProceeds − (q × avgCost at the time of the sale)`. Net of everything the broker
  took, so it is what the sale actually added to net worth.
- Summed across all sales for the Portfolio all-time figure.
- The gross counterpart, `q × price − fees − (q × avgCost)`, is what the tax was computed on — the
  same shape as `taxableGain` in [§11.3](#113-hypothetical-liquidation), fee first, which is why the
  estimate and the record are comparable at all. It is not displayed: the tax on a real sale is a
  recorded fact, so there is nothing to reconcile it against.

## 11.3 Hypothetical liquidation

- `grossProceeds = quantity × price`, where `price` is the value of the security's latest Price
  record, **or 0 when it has none**.
- **A holding with no price is worth 0**, its gain is minus its cost, its tax is 0 and **no sell fee
  is charged** — what nothing would leave you with is nothing, not minus a commission. Check 3 names
  the security, and [§7.1](07-investments.md#71-holdings) marks the row. This is deliberate: valuing
  an unpriced holding at cost would have buried a missing price inside a number that looks right.
- `fee = institution.defaultSellFee` of the holding's account, or 0 when the account has no
  institution. **Charged once per holding**, so liquidating three positions at one broker is
  estimated with three fees — which is what the broker would in fact charge.
- `taxableGain = grossProceeds − fee − (quantity × avgCost)`
- `tax = taxableGain > 0 ? round(taxableGain × security.taxRate) : 0` — **never negative**; a loss
  produces no rebate.
- `netProceeds = grossProceeds − fee − tax`
- `netGain = netProceeds − (quantity × avgCost)`
- `netGainPct = netGain ÷ (quantity × avgCost)` — the net counterpart of the holding's gross
  `gainPct` ([§2](02-domain-model.md)), shown beside `netGain` in the detail panel of
  [§7.1](07-investments.md#71-holdings) and *undefined* on a position that cost nothing. It is the
  percentage worth quoting about a holding, because it is the one the tax and the fee have been
  taken out of.
- **The fee comes out before the tax, not after it.** A selling commission is a cost of the disposal
  and reduces the gain the tax is computed on — which is how the broker computes it, and the only
  ordering under which this estimate and the recorded figures of
  [§11.2](#112-realised-gain-on-a-sale) mean the same thing by the same arithmetic. It is worth a
  quarter of the fee, and it is worth being right about.
- **Tax is rounded to the cent** before it is subtracted — the one place a figure is rounded
  mid-calculation. It is an amount of money that a broker would withhold in cents, and leaving it
  unrounded would make the per-holding net values fail to add up to the portfolio total by a
  fraction of a cent.
- **netProceeds can be negative, and that is correct.** A position worth less than the fee to sell
  it would cost money to close, and net worth says so. The fee is charged whatever the position is
  worth — a smaller gain does not buy a smaller commission — and a holding whose whole value is a
  rounding error is a thing worth seeing rather than a thing worth flattening to zero. The one
  holding valued at exactly zero is the one with no price at all, above, where no fee is charged
  because nothing is being sold.
- The portfolio-level figure is the sum across all holdings, each with its own institution fee and
  tax rate. It is the *unrealised net investment gain* line on Portfolio, and, added to the
  cost-based total, the headline net worth itself ([§3.1](03-portfolio.md#31-behaviour)).
- **Applies only to open holdings.** A sale that has happened carries the tax the broker actually
  withheld ([§2](02-domain-model.md), [§11.2](#112-realised-gain-on-a-sale)); this section never
  restates it.

> Weighted average is an approximation. A broker may match lots differently when computing the
> taxable gain, so the tax figure is an estimate. **The application must say so wherever the figure
> appears.**

> **Room for another tax system.** Only the Italian one is implemented, and the shape above is
> deliberately the smallest that can hold a different one: the rate is a field on the security
> ([§2](02-domain-model.md)), not a constant; the gain it applies to is computed separately from the
> rate applied to it; and tax appears in exactly two places — this hypothetical, and the recorded
> figure on a sale. Whitelist government bonds already exercise the mechanism at 12,5%, and they are
> why the rate sits on the instrument rather than on its type even now that `Bond` is a type: a BTP
> and a corporate bond are both bonds and are taxed differently. Anything a future regime needs
> beyond a rate per instrument — holding-period relief, loss carry-forward, a personal allowance —
> is a change to this section alone, not to the domain model, and is not designed for now.

## 11.4 Balances and net worth

- Cash account: `accountBalance = openingBalance + Σ transaction amounts`
- Brokerage account: `accountBalance = Σ netProceeds of its holdings`
  ([§11.3](#113-hypothetical-liquidation))
- `netWorth = Σ accountBalance` over open accounts — which, holdings being held in accounts of their
  own, is the whole of it.
- `totalAtCost = Σ cash accountBalance + Σ holding invested`, the same total with holdings at cost.
  `netWorth − totalAtCost` is the unrealised net gain, and the two are the decomposition shown on
  Portfolio ([§3.1](03-portfolio.md#31-behaviour)).
- Securities purchases already reduce the cash account through their transaction, so holdings are
  added, not double-counted.
- **Closed accounts are excluded** — and nothing stops an account being closed with money still in
  it, since checks report rather than block ([§9](09-checks.md)). The exclusion can therefore move
  net worth on its own, which is exactly what check 11 exists to say out loud: it fails naming the
  account and the balance left in it, and the Portfolio banner carries it until the account is
  emptied or its closing date removed. The money is never quietly gone; it is gone and named.

## 11.5 Net worth over time

- Monthly points at each month end, from the month of the earliest transaction up to the last month
  end before today — **plus one final point at today itself**, which is the only point not on a
  month end. Ending on the last completed month would leave the chart short of the headline figure
  above it by however far into the month it happens to be, and the line would appear to stop growing
  for a few weeks every month. The final point is the same date every other figure on the screen is
  computed at ([§11](#11--calculations)).
- At date `d`, over every account whose `openingDate ≤ d` and which was not yet closed at `d`:
  `Σ (openingBalance + Σ transactions ≤ d)` plus, per holding, `quantity(d) × price` where price is
  the **most recent Price record dated ≤ d**. An account contributes nothing before it existed.
- If no price is known at `d`, that holding is valued at `avgCost(d)`. **The dash is per point, not
  per stretch:** a month is dashed when *any* holding open in it fell back to cost, and solid when
  every one of them had a price. In practice that produces a single dashed prefix and a solid
  remainder, because prices start being recorded and then keep being recorded — but the rule is
  stated per point so that a security bought later and never priced dashes the segment it affects
  instead of quietly passing as measured. **This is the one place a missing price is not zero**
  ([§11.3](#113-hypothetical-liquidation)), and the reason is what the chart is for: it shows the
  shape of ten years, not a figure anyone acts on, and a decade of holdings collapsing to zero would
  have said something false about the past rather than something true about the data.
- **The chart is gross** — no hypothetical tax or fee, unlike the headline figure it sits under.
  Applying today's tax rates to a position held eight years ago would be inventing history, and the
  chart is there for shape, not for a number to quote. The final point therefore sits slightly above
  the headline net worth; the legend says so.

## 11.6 Derived matching

Records that ought to correspond are paired heuristically, with **no linking effort from the user**.
Matching is recomputed, never stored.

- **Internal transfer legs:** equal absolute amount, opposite signs, different accounts, dates
  within `transferMatchWindowDays`, both in a category with role `internal transfer`. Greedy
  one-to-one, nearest date first, and ties broken by `insertionSeq` so the result never depends on
  iteration order. Unpaired legs are listed by check 1.
- **The two legs carry the same amount, and a transfer fee is never netted into one of them.** If
  the sending bank takes € 1,00 to make the wire, that euro is **its own transaction** on the
  sending account, in a category with role `bank fees` — never subtracted from the leg. Netting it
  would leave € 501,00 out against € 500,00 in, which is not a pair by any definition the
  application could be given, and check 1 would report it for as long as the file existed. Splitting
  it also puts the fee where the rest of the year's bank charges are, which is where anyone would
  look for it.
- **Trades against transactions:** a transaction whose category role is `securities purchase` /
  `securities sale` pairs with a trade of the matching kind when the absolute amount equals the
  trade total, dates are within `tradeMatchWindowDays`, and **the transaction's account and the
  trade's brokerage account belong to the same institution**. One-to-one. Unmatched records on
  either side are listed by checks 6 and 7.
- The two sides sit in different accounts by construction — the trade in a brokerage account, the
  money in a cash one — so the pairing keys off the institution they share rather than off the
  account. An account with no institution can therefore never pair, which is correct: physical cash
  does not buy securities.
- **A purchase is funded from the broker's own cash account, and that is a rule about how to record,
  not a preference.** Money wired straight from another bank into a trade has no leg at the
  institution the trade sits in, so nothing can pair it and check 6 fails for as long as it stays
  that way. The way to record it is the way it actually happened: an **internal transfer** from the
  other bank into the broker's cash account, then the purchase out of that account. Two legs and a
  trade, each paired, instead of one row that cannot be.
- The trade total is the one from [§2](02-domain-model.md) — `qty × price + fees` on a purchase,
  `qty × price − taxes − fees` on a sale. Both are the figure that moved through the account, which
  is why the comparison is an exact match on the cent-rounded total rather than a tolerance.
- **Payslips against transactions:** a payslip pairs with a transaction in a role `salary` category
  whose amount equals its `netPayment` and whose date falls in the payslip's own month or the month
  after. One-to-one, earliest transaction first. The same rule pairs `pensionContribution` against
  role `pension contribution` transactions. **The window is a whole month, not a number of days**,
  because what varies is which month the employer pays in, not by how many days it slips. Check 4
  reports both sides.
- **A `netPayment` of zero pairs like any other figure**, against a transaction of `0,00`. A payslip
  that paid out nothing — everything withheld, or a correction that cancelled itself — is a real
  payslip and the bank has a real row for it, so both sides are legal amounts
  ([§13](13-validation.md)) and the ordinary equality finds them. Nothing special-cases zero on this
  path.
- **Pension contributions are compared as monthly totals, not paired.** A month's contribution
  reaches the fund as two or three credits — employee share, employer share, TFR — against one
  figure on the payslip, so there is nothing to pair one to one. Months are walked in ascending
  order; each claims the role `pension contribution` transactions dated in it or the month after
  that no earlier month has claimed, and its total is compared with the sum of `pensionContribution`
  over that month's payslips. Check 5 reports the months that disagree, with the difference.

## 11.7 Salary figures

- `netSalary = netPayment − refunds + carPayment`
- `netGrossPct = netSalary ÷ gross`
- `yearContractGross = max(contractGross in year) × contract.monthsPerYear`
- `yearAvgGross = Σ gross in year ÷ count of payslips in year`, and the same over `netSalary` for
  `yearAvgNet`. **The divisor is the payslips there were**, not twelve and not `monthsPerYear`: a
  year with five payslips averages over five, which is what makes these the only salary figures a
  partial year does not understate ([§8.1](08-salaries.md#81-payslips)). A year carrying a
  tredicesima averages over thirteen rows, so strictly the figure is the average **payslip** rather
  than the average calendar month — which is the intended reading, a thirteenth month of pay being
  pay, and spreading it over twelve would flatter every month by a thirteenth. The payslip count in
  the per-year table is what makes the divisor visible.
- Both feed the averages chart of [§8.1](08-salaries.md#81-payslips) and appear nowhere else. The
  per-year table carries totals and rates, so no figure in the application is an average and a total
  of the same thing sitting two columns apart.
- `grossPerHour = Σ gross in year ÷ (workingDays × contract.hoursPerDay)`, and the same with
  `Σ netSalary`. `workingDays` is the whole calendar year ([§2](02-domain-model.md)), so a partial
  year understates both — accepted, see [§8.1](08-salaries.md#81-payslips).
- Per-year `netGrossPct = Σ netSalary in year ÷ Σ gross in year`, not the average of the monthly
  percentages.
- All of the above are computed within the selected contract only.

---

[← §10 Settings](10-settings.md) · [§12 Storage →](12-storage.md)
