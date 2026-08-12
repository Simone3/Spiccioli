# §3 — Portfolio

*[Index](../README.md) · [mockups for this section](../mockups/03-portfolio.html)*

The home screen. No tabs.

> **Mockup —** [Portfolio](../mockups/03-portfolio.html#portfolio)

---

## In brief

- A **failing-check banner** sits above everything whenever any check fails, naming each one and
  linking to [§9](09-checks.md). Nothing is shown when all pass.
- **Net worth** is the headline: cash at its balance, holdings at their latest price less the
  hypothetical tax and sell fee of [§11.3](11-calculations.md#113-hypothetical-liquidation).
- Beneath it, **total at cost** and **unrealised net investment gain**, in that order. They add to
  the headline. No other decomposition is shown.
- **All-time card**: lifetime sums of the `bank fees`, `wealth tax` and `interest and dividends`
  roles, plus realised gain — which covers the sales that have one and says how many it left out.
- **Every figure on the screen counts closed accounts.**
- **Breakdown by type**: the five cash types and the five security types, only those present. A
  negative or zero type keeps its row and its amount, reads 0,0% and gets no slice. Shares are
  computed against the total of the positive types. Ordered by share, then by amount descending.
- **Net worth over time**: monthly points plus one at today, plotting the same quantity as the
  headline and ending on it to the cent. Months where a holding fell back to cost are dashed.
- **Accounts table**: every account with its balance, closed ones dimmed and last, totalling to the
  headline. Read-only.

---

## 3.1 Behaviour

- **Failing-check banner.** Shown whenever any check fails, above everything else, naming each
  failing check in one line and linking to [§9](09-checks.md). Absent when all pass.
- **Net worth is what the portfolio is worth in hand**
  ([§11.4](11-calculations.md#114-balances-and-net-worth)): cash at its balance, holdings at their
  latest known price *less* the hypothetical capital-gains tax and sell fee of
  [§11.3](11-calculations.md#113-hypothetical-liquidation).
- **Three figures, in this order, and the lower two add up to the headline.** *Net worth* is the
  headline. **Total at cost** sits beneath it: the same total with holdings valued at what they were
  paid for instead — Σ cash balances + Σ holdings at cost — which is the portfolio as the ledger
  recorded it, opening balances and transactions and purchase prices and nothing estimated.
  **Unrealised net investment gain** sits beneath that: what selling every holding today would add
  to the portfolio or take out of it, net of the tax and the fees of
  [§11.3](11-calculations.md#113-hypothetical-liquidation). It is exactly the difference between the
  two figures above it, so `total at cost + unrealised net investment gain = net worth` by
  construction.
- **That is the only decomposition offered, and it splits net worth by what is measured rather than
  by where the money sits.** Cash and holdings are deliberately not shown as two totals here: a split
  by kind of asset is the breakdown further down the same screen, and one figure appearing twice on
  one screen is a figure that can disagree with itself. **The line is not a sum of transactions**, and
  must not be labelled as one: it includes opening balances, which are not transactions, and it
  values holdings at their cost basis, which is not a transaction either.
- **The headline figure is therefore an estimate**, and must carry the
  [§11.3](11-calculations.md#113-hypothetical-liquidation) caveat on hover: it rests on average-cost
  lot matching and moves if a security's `taxRate` or an institution's sell fee changes. The gross,
  untaxed picture is one screen away, on Investments ([§7.1](07-investments.md#71-holdings)), where
  the per-holding breakdown lives.
- **All-time figures** are lifetime sums of the categories carrying the roles `bank fees`,
  `wealth tax` and `interest and dividends`, plus realised gain from sales
  ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)). Unlike net worth, realised gain is a
  recorded fact, not an estimate.
- **Realised gain covers the sales that have one.** A sale in a (security, account) whose running
  quantity ever went below zero has no average cost to be measured against and therefore no realised
  gain at all ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)); those sales are left out of
  the sum, and the card says how many it left out and links to checks 8 and 9, which name the trades
  ([§9](09-checks.md)). A total that silently omitted them would be the one figure on this card that
  is not what it says it is.
- **Every figure on this screen counts closed accounts**, all-time and net worth alike. A closed
  account should be an empty one — check 11 fails by name while it is not
  ([§9](09-checks.md)) — so in a file whose checks pass it contributes nothing to net worth anyway,
  and in a file whose checks do not it contributes the balance that is really still there. Nothing is
  dropped from a total for having been closed: the bank charged those fees, that interest was
  received, that sale really was made, and money left in a shut account is money the file still says
  you have. The rule is the same one the report follows ([§6.1](06-categories.md#61-report)) — a
  closing date marks an account and sorts it last, it does not remove it from the arithmetic.
- **Those three roles exist for this card and nothing else.** The category list is fixed
  ([§6.3](06-categories.md#63-category-list)), so the card could have named its three categories
  directly and been correct forever — but every other part of the application that cares about a
  particular kind of money keys off `role`, and one screen quietly matching on names would have been
  the exception that made the rule untrue. Roles cost nothing and keep the promise whole.
- **Breakdown by type.** Cash accounts contribute under the account's type; holdings contribute
  under their *security's* type, at the same net value used for net worth. A brokerage account never
  appears as a slice of its own — it is entirely its holdings — so the types available are the five
  cash types plus the five security types. Closed accounts and their holdings are in it, like
  everywhere else, which is what keeps the slices adding to net worth. **Only types actually present
  get a slice**: the ten are the ceiling, and the nine in the mockup are what that portfolio happens
  to hold — a `Bond` bought tomorrow would make ten.
- **The pie** carries one slice per type present, sized by its share, with the slice count at its
  centre and the same colour keying the list beside it. It exists to make the shape of the portfolio
  readable at a glance; the list beside it carries the amounts and percentages.
- **A type can total less than nothing, and then the amount is shown and the share is not.** An
  overdrawn current account does it, and so does a holding worth less than the fee it would cost to
  sell ([§11.3](11-calculations.md#113-hypothetical-liquidation)). The row keeps its place in the
  list and shows the negative amount — that figure is the whole reason anyone would want the row —
  but reads **0,0%** and is **given no slice**. A negative arc cannot be drawn, and pretending
  otherwise would leave a circle whose parts sum to more than the circle.
- **A type totalling exactly nothing is the same case**: it shows `€ 0,00` and **0,0%** and is given
  no slice, because a slice of no size is not a slice. It is still a row — an emptied voucher
  balance or a term deposit that has just been paid out is a type the portfolio has and a shape it
  no longer contributes to, and a row saying so is worth more than a row that vanished.
- **Shares are therefore computed against the total of the positive types**, not against net worth,
  which is what keeps the column adding to 100% while a negative type sits in it. The two figures
  differ by exactly the negative amounts, which are on screen a line away. If no type is positive at
  all there is nothing to draw: the pie is replaced by a line saying the portfolio has no positive
  value to divide up, and the list still shows every amount.
- **Both are ordered by share, largest first**, and in the same order — the list reads down in the
  order the slices are drawn clockwise, so finding a slice in the legend is following a line rather
  than searching. Types with no share sort last, **by amount descending** — zero first, then the
  negatives from least to most — which keeps the whole column reading downwards from the largest
  contribution to the deepest hole. This is the one
  table in the application ordered by its own amounts (compare
  [§6.1](06-categories.md#61-report)): there are nine rows, they are a shape rather than a ledger,
  and the shape is the entire point of drawing them.
- **Net worth over time**, monthly points from the start of the file to today,
  [§11.5](11-calculations.md#115-net-worth-over-time). **It plots the same figure as the headline** —
  net of the hypothetical tax and sell fee, at each date rather than only at today's — so its last
  point is the headline, to the cent. A chart sitting under a number and ending somewhere else would
  spend every reading being explained.
- Any month in which at least one holding had to be valued at cost is drawn dashed and labelled as
  cost-based; the line goes solid at the first month in which every holding had a price. **Only a
  month earlier than a security's first recorded price can be dashed** — a security with no price at
  all is worth zero on this line exactly as it is on the card above, which is what leaves the final
  point equal to the headline to the cent and means today's point is never dashed
  ([§11.5](11-calculations.md#115-net-worth-over-time)). The dashed
  stretch is the only part that is not net worth as computed everywhere else, and the legend also
  says that the rate and the fee applied across the whole line are today's, those being the only
  ones the file records ([§11.5](11-calculations.md#115-net-worth-over-time)).
- **Accounts table** lists every account with its computed balance, brokerage accounts among them
  and closed ones dimmed and last ([§4.1](04-accounts.md#41-accounts)); its total is the headline net
  worth, which is only true because nothing is left out of it. This and the Accounts screen are the
  two places every account is shown together, and neither filters ([§2](02-domain-model.md)).
  Read-only — accounts are created, edited and closed on the Accounts screen
  ([§4.1](04-accounts.md#41-accounts)).

---

[← §2 Domain model](02-domain-model.md) · [§4 Accounts →](04-accounts.md)
