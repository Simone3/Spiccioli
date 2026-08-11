# §7 — Investments

*[Index](../README.md) · [mockups for this section](../mockups/07-investments.html)*

Four tabs: Holdings, Purchases, Sales, Securities. Holdings is entirely derived from the middle two;
Securities is what all three point at.

---

## 7.1 Holdings

> **Mockup —** [Holdings tab](../mockups/07-investments.html#holdings)

- One row per (security, brokerage account) with quantity > 0. Every figure is derived, and every
  column is read-only **except the price**.
- **This is where prices are kept up to date.** Clicking the price cell opens an inline editor — a
  value and an as-of date defaulting to today — and saving writes a Price record, replacing whatever
  that day already held ([§2](02-domain-model.md)). The whole editable history of a security lives
  on the Securities tab of this same screen ([§7.4](#74-securities)); Holdings is the fast path for
  the one thing done weekly, that tab is where a past mistake is repaired.
- **Update prices** fetches from the provider ([§7.6](#76-prices)). It is a button and nothing else
  — there is no setting behind it, and pressing it is the only thing that ever contacts the network.
  Never press it and the inline editor is the only way in, which is a complete way to use the
  application.
- A price older than `priceStalenessDays` is marked on the row itself, not only in
  [§9](09-checks.md). **A security with no price at all is marked more loudly**: its price cell
  reads *none*, its value and gain read `€ 0,00`, and check 3 fails. Valuing it at cost instead
  would have hidden the omission inside a plausible number, and a holding worth nothing is the one
  wrong answer nobody mistakes for the right one
  ([§11.3](11-calculations.md#113-hypothetical-liquidation)).
- The table carries **gross** value and gain — market price, no tax, no fees. This is the
  counterpart to the Portfolio headline, which is net ([§3.1](03-portfolio.md#31-behaviour)); one
  screen shows what the positions are worth, the other what they would leave you with.
- Selecting a row opens the detail panel: lots purchased and sold, weighted average cost, invested
  total, and the full hypothetical liquidation breakdown
  ([§11.3](11-calculations.md#113-hypothetical-liquidation)).
- The caveat about lot matching is shown in the panel, next to the number it qualifies.

## 7.2 Purchases

> **Mockup —** [Purchases tab](../mockups/07-investments.html#purchases)

- Where purchase trades are created, edited in place and deleted. Every column but *Total cost* and
  *Matched* is editable.
- **Account** is the brokerage account the security sits in. The cash for the trade moved through a
  different account — a cash one at the same institution — and pairing the two is what
  [§11.6](11-calculations.md#116-derived-matching) does.
- **Total cost** is `qty × price + fees`, derived, never entered. It is the figure
  [§11.6](11-calculations.md#116-derived-matching) pairs against the bank transaction.
- **Matched** shows the date of the bank transaction the application paired the trade with
  ([§11.6](11-calculations.md#116-derived-matching)). A dash is what check 6 reports.
- Recording a trade **does not** create a transaction.
- Ordering: `date ASC, insertionSeq ASC` — the same direction as Transactions, so both ledgers read
  the same way. No paging; filters narrow the list instead.
- Filters: security, account — **brokerage accounts only** ([§2](02-domain-model.md)) — and period.

## 7.3 Sales

> **Mockup —** [Sales tab](../mockups/07-investments.html#sales)

- The same table as Purchases with **three columns it does not have**. *Taxes* is the capital-gains
  tax the broker actually withheld, entered from the trade confirmation. *Net proceeds* replaces
  *Total cost* — `qty × price − taxes − fees`, what actually reached the account. *Realised gain* is
  derived per [§11.2](11-calculations.md#112-realised-gain-on-a-sale) and is the only figure on
  either tab that is neither entered nor a restatement of what was.
- **Taxes is zero, not blank, when nothing was withheld** — a sale at a loss, as in March 2020
  above, or one whose gain the broker offset against a carried-forward loss. Blank would be
  indistinguishable from “not filled in yet”, and the figure feeds check 7.
- **Realised gain is net of everything the broker took**, so a sale can show a gain before tax and a
  loss after it. It is summed into the all-time figure on Portfolio ([§3](03-portfolio.md)), where
  it is the one investment number that is a recorded fact rather than an estimate.
- The footer sums fees, taxes, net proceeds and realised gain. It is the only place the tax actually
  paid over ten years is visible as one figure.
- Everything else — ordering, filters, editing, matching, the fact that a sale creates no
  transaction — is exactly as [§7.2](#72-purchases).

## 7.4 Securities

> **Mockup —** [Securities tab](../mockups/07-investments.html#securities)

- **Not where securities are created** — that happens inline while recording the first trade
  ([§7.5](#75-recording-a-trade-and-where-securities-come-from)). This tab is where one is corrected
  afterwards: a mistyped ISIN, a renamed instrument, the wrong type, the tax rate on a whitelist
  government bond.
- **Held** is the quantity across every brokerage account, an em dash when the position is closed.
  **Trades** is what decides whether the security can be deleted; **Prices** does not. A price is
  part of a security rather than a reference to one, so deleting a security deletes its history with
  it and the confirmation says how many records that is — a fully sold instrument entered by mistake
  goes away in one action ([§13](13-validation.md)).
- **The full price history lives here, and every record in it can be edited or deleted.** Holdings
  ([§7.1](#71-holdings)) is the fast path for the one price recorded weekly; this is where a value
  typed into the wrong day is repaired. Editing a record's value replaces it; editing its date moves
  it, replacing whatever occupied the day it lands on ([§2](02-domain-model.md)). Deleting removes
  the day entirely, which is the only way to undo a price recorded against a date that never had
  one.
- The history is **newest first** — the opposite of every other table in the application, and
  deliberately so: the reason to open it is almost always the most recent value, and the ten-year
  tail is reached by scrolling rather than by paging.
- Changing a security's **tax rate** changes the
  [§11.3](11-calculations.md#113-hypothetical-liquidation) estimate for it and therefore net worth,
  and changes nothing that was ever recorded — a sale carries the tax the broker actually withheld
  ([§7.3](#73-sales)).

## 7.5 Recording a trade, and where securities come from

> **Mockup —** [Record a purchase · new security](../mockups/07-investments.html#record-trade)

- **Total cost** is computed and shown live as quantity, price and fees are typed — never entered.
  It is the figure [§11.6](11-calculations.md#116-derived-matching) pairs against the bank
  transaction.
- **Account** lists brokerage accounts only, and defaults to the one last used.
- **Securities are created inline, here.** Typing an ISIN or ticker searches existing securities; if
  none matches, the form expands with the fields needed to create one, and it is saved together with
  the trade. There is no separate “create a security first” step.
- **Tax rate** is pre-filled from `defaultTaxRate` and only needs touching for a whitelist
  government bond. It affects the [§11.3](11-calculations.md#113-hypothetical-liquidation) estimate
  and nothing that is ever recorded.
- **The Securities tab covers everything afterwards** ([§7.4](#74-securities)): correcting the
  security, and its whole price history. Inline creation covers the common path; the tab covers the
  rest.
- **The sale form adds a Taxes field** below Fees, and shows **net proceeds** —
  `qty × price − taxes − fees` — live in place of total cost. It defaults to zero and is never
  pre-filled from the hypothetical rate of [§11.3](11-calculations.md#113-hypothetical-liquidation):
  an estimate silently becoming a recorded figure is exactly the kind of thing [§9](09-checks.md)
  exists to catch, and it would defeat check 7.

## 7.6 Prices

- Prices are entered per security with an **as-of date**, inline on Holdings
  ([§7.1](#71-holdings)) or on the Securities tab ([§7.4](#74-securities)), and every day is kept as
  history. Recording a price for a day that already has one replaces that day and leaves the rest of
  the history alone.
- **A price belongs to the security, not to a holding.** The same instrument held at two
  institutions is two holdings and one price, so editing the price on either row moves both. The
  inline editor says so.
- **That is a simplification, and a safe one.** Two brokers quote the same instrument within a
  fraction of a percent of each other at any moment, and the difference between them is a spread,
  not a value — but it is not literally one number: an ETF cross-listed on Borsa Italiana and Xetra
  has two quotes, and a broker's screen is a snapshot of a different second. None of it survives the
  only use this figure has, which is valuing a position to the euro once a week. **If two quotes
  ever differ enough to matter, they are two listings and belong to two securities**, each with its
  own ISIN and its own holding — which the model already supports and which is what the difference
  is telling you.
- **A security with no price at all values at zero**, everywhere a current figure is shown, and
  fails check 3 by name. The one exception is the historical chart of
  [§11.5](11-calculations.md#115-net-worth-over-time), which values a holding at cost for the
  stretch before its first recorded price and draws it dashed — a chart that exists to show shape
  can afford an approximation that a figure on the home screen cannot.
- **Online lookup has no setting: it is the *Update prices* button ([§7.1](#71-holdings)) and
  nothing else.** Pressing it is the only thing that ever contacts the network — never automatic,
  never on load, never in the background. A switch in Settings would have been a second way to
  express what the button already expresses by not being pressed, and a state in which the button is
  present but refuses is worse than no state at all.
- It sends security identifiers — ISIN or ticker — to the provider. **No amounts, quantities or
  account data ever leave the machine.** The application must state this **next to the button**,
  which is the moment it matters and now the only place the feature is visible.
- **Which provider is built in, not chosen.** There is one, named in the application, with no
  endpoint or credential to configure. A setting for the URL would have implied the application can
  talk to whatever is put in it, which is not true: a price provider has a response shape, and
  reading it is code. When the provider has to change, that is a new version, and
  [§1](01-premise-and-constraints.md)'s promise about what leaves the machine stays something this
  document can actually make.
- Fetched values are shown for confirmation before being written as `source = fetched` Price
  records.
- The application is fully usable without ever pressing the button. A provider failure is a message,
  never a blocked screen.

---

[← §6 Categories](06-categories.md) · [§8 Salaries →](08-salaries.md)
