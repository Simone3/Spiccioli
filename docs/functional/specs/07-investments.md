# §7 — Investments

*[Index](../README.md) · [mockups for this section](../mockups/07-investments.html)*

Four tabs: Holdings, Purchases, Sales, Securities. Holdings is entirely derived from the middle two;
Securities is what all three point at.

---

## 7.1 Holdings

> **Mockup —** [Holdings tab](../mockups/07-investments.html#holdings)

- One row per (security, brokerage account) holding a position — quantity greater than 0, and a
  running quantity that never went below it ([§2](02-domain-model.md)). Every figure is derived, and
  every column is read-only **except the price**.
- **Ordered by the security's `ticker`, alphabetically**, then by account name where one security is
  held at two brokers and is therefore two rows ([§2](02-domain-model.md)). Case- and
  accent-insensitive, like every other comparison of text in the application.
- **This is where prices are kept up to date.** Clicking the price cell opens an inline editor — a
  value and an as-of date defaulting to today — and saving writes a Price record, replacing whatever
  that day already held ([§2](02-domain-model.md)). **Nothing is confirmed**: the editor shows the
  value the chosen day currently holds, if it holds one ([§13](13-validation.md)). The whole editable
  history of a security lives on the Securities tab of this same screen ([§7.4](#74-securities)).
- **Update prices** sits on this screen; [§7.6](#76-prices) is what it does. It is a button and
  nothing else — no selection first, no confirmation after, no setting behind it — and pressing it is
  the only thing in the application that ever contacts the network. Never press it and the inline
  editor is the only way a price gets in, which is a complete way to use the application.
- A price older than `priceStalenessDays` is marked on the row itself, not only in
  [§9](09-checks.md). **A security with no price at all is marked more loudly**: its price cell
  reads *none*, its value reads `€ 0,00`, its gain reads **minus everything the position cost**, and
  check 3 fails ([§2](02-domain-model.md),
  [§11.3](11-calculations.md#113-hypothetical-liquidation)).
- The table carries **gross** value and gain — market price, no tax, no fees. This is the
  counterpart to the Portfolio headline, which is net ([§3.1](03-portfolio.md#31-behaviour)).
- Selecting a row opens the detail panel: **quantity purchased with the number of lots it came
  from**, **quantity sold**, weighted average cost, invested total including fees, and then the full
  hypothetical liquidation breakdown ([§11.3](11-calculations.md#113-hypothetical-liquidation)) —
  gross proceeds, the sell fee with the institution whose default it is, taxable gain, tax with the
  rate and the security it belongs to, net proceeds, and net gain **with its percentage**.
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
- Ordering: `date ASC, insertionSeq ASC, id ASC` — the same three keys and the same direction as
  Transactions ([§5.2](05-transactions.md#52-ordering-and-paging)). No paging; filters narrow the
  list instead.
- Filters: security, account — **brokerage accounts only** ([§2](02-domain-model.md)) — and period,
  which is the *from* and *to* pair of [§5.3](05-transactions.md#53-filters), inclusive at both ends.

## 7.3 Sales

> **Mockup —** [Sales tab](../mockups/07-investments.html#sales)

- The same table as Purchases with **three columns it does not have**. *Taxes* is the capital-gains
  tax the broker actually withheld, entered from the trade confirmation. *Net proceeds* replaces
  *Total cost* — `qty × price − taxes − fees`, what actually reached the account. *Realised gain* is
  derived per [§11.2](11-calculations.md#112-realised-gain-on-a-sale) and is the only figure on
  either tab that is neither entered nor a restatement of what was.
- **Taxes is zero, not blank, when nothing was withheld** — a sale at a loss, like the March 2020
  row in the mockup, or one whose gain the broker offset against a carried-forward loss. The figure
  feeds check 7.
- **Realised gain is net of everything the broker took**, so a sale can show a gain before tax and a
  loss after it. It is summed into the all-time figure on Portfolio ([§3](03-portfolio.md)), where
  it is the one investment number that is a recorded fact rather than an estimate.
- **Realised gain reads *undefined* when the position it came out of has no average cost.** A sale in
  a (security, account) whose running quantity ever went below zero has no cost basis to measure
  against: the walk of [§11.1](11-calculations.md#111-weighted-average-cost) stops, no `avgCost`
  exists, and the figure is undefined rather than zero or blank
  ([§11.2](11-calculations.md#112-realised-gain-on-a-sale), [§11](11-calculations.md)). The row is
  shown in full and only that one cell says so. Checks 8 and 9 name the trade that caused it, and
  putting the dates or the missing purchase right restores the figure ([§9](09-checks.md)).
- The footer sums fees, taxes, net proceeds and realised gain. It is the only place the tax actually
  paid over ten years is visible as one figure. **The realised-gain total covers the sales that have
  one** and says how many it left out, which is the same rule the Portfolio all-time card follows
  ([§3.1](03-portfolio.md#31-behaviour)); the other three columns are entered figures and always
  total everything.
- Everything else — ordering, filters, editing, matching, the fact that a sale creates no
  transaction — is exactly as [§7.2](#72-purchases).

## 7.4 Securities

> **Mockup —** [Securities tab](../mockups/07-investments.html#securities)

- **One of the two places a security is created**, and the place one is corrected. *Add security*
  here creates it on its own; the purchase form creates it inline while recording the first trade
  that needs it ([§7.5](#75-recording-a-trade-and-where-securities-come-from)). The fields are the
  same either way and so is the record — there is no such thing as a security that came in by one
  path rather than the other.
- Correcting is the rest of the tab's job: a mistyped ISIN, a renamed instrument, the wrong type,
  the tax rate on a whitelist government bond.
- **Ordered by `ticker`, alphabetically**, the same key and the same comparison as Holdings
  ([§7.1](#71-holdings)). Securities no longer held are in the list like everything else, marked by
  an em dash in *Held*; nothing sorts them apart.
- **Held** is the quantity across every brokerage account, an em dash when the position is closed.
  **Trades** is what decides whether the security can be deleted; **Prices** does not. Deleting a
  security deletes its price history with it and the confirmation says how many records that is
  ([§13](13-validation.md)).
- **The full price history lives here, and every record in it can be edited or deleted.** Editing a
  record's value replaces it; editing its date moves it, replacing whatever occupied the day it lands
  on ([§2](02-domain-model.md)) — **and neither is confirmed** ([§13](13-validation.md)). **Deleting
  is confirmed**, like every delete in the application; **this is the only place a price is
  deleted**, and it is the only way to undo a price recorded against a date that never had one.
- The history is **newest first** — the opposite of every other table in the application.
- Changing a security's **tax rate** changes the
  [§11.3](11-calculations.md#113-hypothetical-liquidation) estimate for it and therefore net worth,
  and changes nothing that was ever recorded — a sale carries the tax the broker actually withheld
  ([§7.3](#73-sales)).

## 7.5 Recording a trade, and where securities come from

> **Mockup —** [Record a purchase · new security](../mockups/07-investments.html#record-trade)

- **Total cost** is computed and shown live as quantity, price and fees are typed — never entered.
  It is the figure [§11.6](11-calculations.md#116-derived-matching) pairs against the bank
  transaction.
- **Account** lists brokerage accounts only and starts empty, no picker in the application
  remembering what was chosen last ([§5.5](05-transactions.md#55-add-transaction)).
- **A security can be created inline, here.** Typing an ISIN or ticker searches existing securities;
  if none matches, the form expands with the fields needed to create one, and it is saved together
  with the trade. No “create a security first” step is *required* — the Securities tab has *Add
  security* for when it is wanted anyway ([§7.4](#74-securities)).
- **Tax rate** is pre-filled from `defaultTaxRate` and only needs touching for a whitelist
  government bond. It affects the [§11.3](11-calculations.md#113-hypothetical-liquidation) estimate
  and nothing that is ever recorded.
- **The Securities tab covers everything afterwards** ([§7.4](#74-securities)): correcting the
  security, and its whole price history.
- **The sale form adds a Taxes field** below Fees, and shows **net proceeds** —
  `qty × price − taxes − fees` — live in place of total cost. It defaults to zero and is never
  pre-filled from the hypothetical rate of [§11.3](11-calculations.md#113-hypothetical-liquidation).

## 7.6 Prices

- Prices are entered per security with an **as-of date**, inline on Holdings
  ([§7.1](#71-holdings)) or on the Securities tab ([§7.4](#74-securities)), and every day is kept as
  history. Recording a price for a day that already has one replaces that day and leaves the rest of
  the history alone.
- **A price belongs to the security, not to a holding.** The same instrument held at two
  institutions is two holdings and one price, so editing the price on either row moves both. The
  inline editor says so.
- **If two quotes ever differ enough to matter, they are two listings and belong to two securities**,
  each with its own ISIN and its own holding — which the model already supports.
- **A security with no price at all values at zero**, everywhere a current figure is shown, and
  fails check 3 by name while it has an open holding ([§9](09-checks.md)) — a fully sold one has no
  position left to value and no check to fail. That is true on the historical chart of
  [§11.5](11-calculations.md#115-net-worth-over-time) as well: what the chart values at cost is the
  stretch **before a security's first recorded price**, drawn dashed.
- **Online lookup has no setting: it is the *Update prices* button ([§7.1](#71-holdings)) and
  nothing else.** Pressing it is the only thing that ever contacts the network — never automatic,
  never on load, never in the background.
- **One press covers every security in the file**, held or fully sold, and asks for one thing: the
  **latest quote the provider has**, whatever day it belongs to. There is no list to tick first.
- **What comes back is written straight in, dated the day the quote is for** — not the day the
  button was pressed — as a `fetched` Price record replacing whatever that day already held
  ([§2](02-domain-model.md)).
- **A quote the provider dates in the future is not written**, on the same rule that governs a typed
  one ([§13](13-validation.md)). It is reported as a security that could not be fetched.
- **Nothing is shown for confirmation first.**
- **A security the provider has no quote for at all is left exactly as it is.** No record is
  written, the price it already had still stands and still ages towards check 3, and nothing is
  carried forward or invented. The same is true of one the provider does not recognise, or of a
  fetch that fails outright.
- **The notice afterwards is the whole report of the pass**: how many prices were written and **what
  dates they carry** — one line when they all share a date, which is the ordinary case, and the
  spread with the securities named when they do not — how many securities had no quote, and how many
  could not be fetched at all, **naming the securities in the last two groups**. Check 3 measures
  staleness from those dates and not from the moment the button was pressed. The notice sits on the
  screen until dismissed. Nothing about a failed fetch is recorded in the file — the remedy is to
  press the button again or to type the price in by hand ([§7.1](#71-holdings)).
- **What leaves the machine is an identifier for a security and nothing else** — whichever of the
  ones the file already holds the provider takes, an ISIN or a ticker — and what comes back is a
  quote and the date it belongs to. **No amounts, quantities, balances or account data ever leave.**
  The application must state this **next to the button**.
- **Which provider, and exactly what it is sent, are settled when the application is built, not
  here.** This section fixes the shape of the exchange — identifiers out, latest quote and its date
  back, one press, no configuration. What this document commits to is: **one provider, built in,
  named on screen beside the button**, with **no endpoint, key or credential to configure**, and
  nothing sent beyond an identifier. When the provider has to change, that is a new version.
- The application is fully usable without ever pressing the button. A provider failure is a line in
  the notice, never a blocked screen.

---

## Why it is this way

- **Holdings are ordered by ticker** because the ticker is what the row leads with and what the eye
  scans — a table ordered by a field printed in small type beside the one being read looks unsorted,
  whatever the rule behind it says. Not by value and not by gain: this is a table of positions to be
  found and priced, and the one thing known before opening it is which instrument is being looked
  for. Portfolio is where the shape of the money is read, and that is the one table sorted by its own
  amounts ([§3.1](03-portfolio.md#31-behaviour)).
- **The inline price editor confirms nothing** because what is about to be replaced is on screen
  while the new figure is typed, and a weekly correction does not cost a dialog. Holdings is the fast
  path for the one thing done weekly; the Securities tab is where a past mistake is repaired.
- **An unpriced holding is worth nothing rather than worth its cost.** What the row is saying is that
  this holding is currently worth nothing, and a position worth nothing has lost exactly what was
  paid for it. Valuing it at cost instead would have hidden the omission inside a plausible number,
  and a holding worth nothing is the one wrong answer nobody mistakes for the right one.
- **The Holdings table is gross and the Portfolio headline is net**: one screen shows what the
  positions are worth, the other what they would leave you with.
- **The detail panel carries both quantities** because the *Qty* column is their difference
  ([§2](02-domain-model.md)), and a holding never sold and one bought twice over and half sold reach
  it by different routes. This is the panel that says which.
- **Taxes on a sale is zero rather than blank** because blank would be indistinguishable from “not
  filled in yet”.
- **A security is creatable from two places because they answer two moments.** A new instrument
  usually first appears as something being bought, and stopping to create it before the trade can be
  recorded is a detour out of the form you are in. But a security is a thing in its own right — the
  tab that lists them, corrects them and holds their prices has no business refusing to add one, and
  a security is occasionally wanted before any trade exists, to carry a price history that starts
  before the first purchase.
- **Securities and Holdings share an order** because the two tables list the same instruments, both
  lead with the ticker, and there is no reason for them to disagree about where one sits. Fully sold
  securities are not sorted apart, since a security is looked up by what it is called whether or not
  there is a position in it today.
- **Prices go with the security when it is deleted** because a price is part of a security rather
  than a reference to one — which is what lets a fully sold instrument entered by mistake go away in
  one action. Editing a price is not confirmed because one price per day is the model rather than an
  accident to warn about.
- **The price history reads newest first** because the reason to open it is almost always the most
  recent value, and the ten-year tail is reached by scrolling rather than by paging.
- **The sale form never pre-fills the tax from the estimate** because an estimate silently becoming a
  recorded figure is exactly the kind of thing [§9](09-checks.md) exists to catch, and it would
  defeat check 7.
- **One price per security across institutions is a simplification, and a safe one.** Two brokers
  quote the same instrument within a fraction of a percent of each other at any moment, and the
  difference between them is a spread, not a value — but it is not literally one number: an ETF
  cross-listed on Borsa Italiana and Xetra has two quotes, and a broker's screen is a snapshot of a
  different second. None of it survives the only use this figure has, which is valuing a position to
  the euro once a week; a difference big enough to matter is telling you there are two listings.
- **A security with no price is worth zero on the chart too**, rather than falling back to cost,
  because it has no first price to be before — and valuing it at cost at today's point would put the
  end of the line above the net worth printed at the top of the same screen. A chart that exists to
  show shape can afford an approximation for the years nobody was recording prices.
- **There is no setting behind *Update prices*.** A switch in Settings would have been a second way
  to express what the button already expresses by not being pressed, and a state in which the button
  is present but refuses is worse than no state at all.
- **One press covers everything** because a fetch is cheap, the securities are a few dozen, and
  choosing among them is a decision the user would have to make correctly every week to save nothing.
- **The quote is filed under its own day** because a quote is a fact about a trading day, and a
  Friday close filed under Sunday would be a small lie that the net worth chart of
  [§11.5](11-calculations.md#115-net-worth-over-time) then draws. It also makes the button work at
  the weekend, which asking for *today's* quote did not: markets are shut for two days in seven and
  half the times anyone sits down with their accounts, nothing would have been written at all and
  every price would have gone on ageing towards check 3.
- **Nothing is confirmed before the write** because a confirmation step here would be a list of two
  dozen numbers nobody can check — the figure being replaced is a session or two old and the one
  replacing it comes from the same provider — and it would ask the question once per security every
  week.
- **The dates in the notice are the part worth reading**: they say whether the file has just been
  brought up to Friday or up to a fortnight ago.
- **The privacy statement sits next to the button** because that is the moment it matters and the
  only place the feature is visible. Nothing about the portfolio is inferable from a request that
  names an instrument millions of people hold.
- **The provider is deliberately not chosen here.** A provider has a request format, a response
  shape, a rate limit and terms of use, and choosing among those is an engineering decision to be
  made against the providers that exist at the time. What is fixed is the part a later choice cannot
  quietly widen: a setting for the URL would have implied the application can talk to whatever is put
  in it, which will not be true whichever provider is picked, and
  [§1](01-premise-and-constraints.md)'s promise about what leaves the machine stays something this
  document can actually make.

---

[← §6 Categories](06-categories.md) · [§8 Salaries →](08-salaries.md)
