# §3 — Portfolio

*[Index](../README.md) · [mockups for this section](../mockups/03-portfolio.html)*

The home screen. No tabs.

> **Mockup —** [Portfolio](../mockups/03-portfolio.html#portfolio)

---

## 3.1 Behaviour

- **Failing-check banner.** Shown whenever any check fails, above everything else, naming each
  failing check in one line and linking to [§9](09-checks.md). Absent when all pass.
- **Net worth is what the portfolio is worth in hand**
  ([§11.4](11-calculations.md#114-balances-and-net-worth)): cash at its balance, holdings at their
  latest known price *less* the hypothetical capital-gains tax and sell fee of
  [§11.3](11-calculations.md#113-hypothetical-liquidation). It is the sum of the two figures beneath
  it, and those two are the only decomposition offered.
- **Total at cost** is the same total with holdings valued at what they were paid for instead —
  Σ cash balances + Σ holdings at cost. **Unrealised net investment gain** is exactly the difference,
  so the two lines add up to the headline by construction. It was once labelled *sum of all
  transactions*, which was wrong twice over: it includes opening balances, which are not
  transactions, and it values holdings at their cost basis, which is not a transaction either.
- **The headline figure is therefore an estimate**, and must carry the
  [§11.3](11-calculations.md#113-hypothetical-liquidation) caveat on hover: it rests on average-cost
  lot matching and moves if a security's `taxRate` or an institution's sell fee changes. The gross,
  untaxed picture is one screen away, on Investments ([§7.1](07-investments.md#71-holdings)), where
  the per-holding breakdown lives.
- **All-time figures** are lifetime sums of the categories carrying the roles `bank fees`,
  `wealth tax` and `interest and dividends`, plus realised gain from sales
  ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)). Unlike net worth, realised gain is a
  recorded fact, not an estimate.
- **Those three roles exist for this card and nothing else.** The category list is fixed
  ([§6.3](06-categories.md#63-category-list)), so the card could have named its three categories
  directly and been correct forever — but every other part of the application that cares about a
  particular kind of money keys off `role`, and one screen quietly matching on names would have been
  the exception that made the rule untrue. Roles cost nothing and keep the promise whole.
- **Breakdown by type.** Cash accounts contribute under the account's type; holdings contribute
  under their *security's* type, at the same net value used for net worth. A brokerage account never
  appears as a slice of its own — it is entirely its holdings — so the types available are the five
  cash types plus the five security types. Closed accounts and their holdings are excluded. **Only
  types actually present get a slice**: the ten are the ceiling, the nine above are what this
  portfolio happens to hold, and a `Bond` bought tomorrow makes ten.
- **The pie** carries one slice per type present, sized by its share of net worth, with the slice
  count at its centre and the same colour keying the list beside it. It exists to make the shape of
  the portfolio readable at a glance; the list beside it carries the amounts and percentages.
- **Both are ordered by share, largest first**, and in the same order — the list reads down in the
  order the slices are drawn clockwise, so finding a slice in the legend is following a line rather
  than searching. This is the one table in the application ordered by its own amounts (compare
  [§6.1](06-categories.md#61-report)): there are nine rows, they are a shape rather than a ledger,
  and the shape is the entire point of drawing them.
- **Net worth over time**, monthly points from the earliest transaction to today,
  [§11.5](11-calculations.md#115-net-worth-over-time). Any month in which at least one holding had to
  be valued at cost is drawn dashed and labelled as cost-based; the line goes solid at the first
  month in which every holding had a price.
- **Accounts table** lists open accounts with computed balances, brokerage accounts among them; its
  total is the headline net worth. Read-only — accounts are created, edited and closed on the
  Accounts screen ([§4.1](04-accounts.md#41-accounts)).

---

[← §2 Domain model](02-domain-model.md) · [§4 Accounts →](04-accounts.md)
