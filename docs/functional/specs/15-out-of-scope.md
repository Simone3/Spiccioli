# §15 — Out of scope for v1

*[Index](../README.md) · no mockups for this section*

Each of these was raised and deliberately declined. They are listed so they are not reintroduced by accident.

---

| Not building | What is there instead |
| --- | --- |
| Currency, in any form | Everything is EUR and **nothing records a currency**: no field on accounts or securities, no picker on a form, no symbol in the preferences ([§1](01-premise-and-constraints.md), [§13](13-validation.md)). |
| A second interface language | English only, no language selector. Strings stay separable so it remains possible ([§1](01-premise-and-constraints.md)). |
| Tax systems other than the Italian one | Rate per security is a parameter, not a constant ([§11.3](11-calculations.md#113-hypothetical-liquidation)). |
| Export in any format | The file is the data, and [§12](12-storage.md) documents it well enough to read with a script. No CSV, no report export. |
| Accessibility work and keyboard shortcuts | Not designed for v1. Dark theme, mouse-first, one user. |
| Editing the category list at runtime | Categories are stored records with stable ids ([§2](02-domain-model.md)), but the application seeds them and offers no editor. |
| Undo / redo | Backups and delete confirmation cover it for now. |
| Bank-specific import profiles | One fixed column order; the user pre-formats the export. Explicitly future work. |
| Bank exports in any other shape | Trailing-sign negatives (`54,80-`), parenthesised negatives, a separate debit/credit column pair, a `D`/`C` marker, a header row, a non-breaking space where a thousands separator is expected, quoted fields and a leading byte-order mark are none of them handled. A **leading `+`** and a **`€` or `EUR` marker** on the amount *are* read, as is an ordinary space used as a thousands separator when the control says so ([§5.7](05-transactions.md#57-bulk-import)). Neither are dates carrying a month name, a weekday, a time or a two-digit year (`11/07/26`). Three columns, fixed order, one signed amount, and the three format controls of [§5.7](05-transactions.md#57-bulk-import) saying what its characters mean: reshape the export before pasting, and anything that does not fit is reported as a row that cannot be read rather than guessed at. A fourth column and beyond is the one thing tolerated. |
| Term-deposit maturity | Not tracked. A term deposit carries no maturity date and nothing announces one — the date goes in the account's notes if it is wanted, and the bank is what tells you the money has moved. |
| Bulk import of trades | The form of [§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from) is the one way in. |
| Bulk import of payslips | The ten years of history come in with everything else, through the migration script. |
| A migration importer | A one-off custom script will load the Excel history. |
| Category groups | The list is readable flat. |
| Monthly reports | Yearly only. |
| Voucher expiry | Not tracked. |
| Automatic transaction generation from trades, or paired transfer entry | Both sides are recorded independently ([§1](01-premise-and-constraints.md), [§9](09-checks.md)). |
| A warning tier on checks | Pass or fail only ([§9](09-checks.md)). |
| Mobile or web deployment | Desktop on macOS, Windows and Linux ([§1](01-premise-and-constraints.md)), single machine. |
| Percentage or tiered sell fees | Flat per institution. |
| Sortable columns | Fixed chronological order everywhere; filters narrow instead. |
| Bulk edit of transactions | Bulk *delete* exists ([§5.6](05-transactions.md#56-selecting-and-deleting-in-bulk)); changing many categories at once is what rules are for. |
| Transferring a position between brokers | Not modelled. Recorded as a sale and a purchase, which invents a realised gain and leaves checks 6 and 7 with no bank transaction to pair; both failures are visible. |
| Corporate actions — splits, mergers, ISIN changes | Not modelled, and **not workable as an adjusting trade either**. **The v1 answer is to delete every trade in the affected (security, account) and record the position again as it stands after the event** — one purchase, at the quantity now held and the average cost the position actually carries. *Why it is this way* below records what was tried and what each attempt breaks. |
| Attributing dividends and coupons to a holding | They arrive as ordinary transactions under *Interest, dividends & bonuses* and stay there. A holding's gain is therefore price only, never total return — the income is counted, just not against the instrument that produced it. |
| Merging two securities | A mistyped ISIN entered twice produces two securities and two half-holdings. The fix is to correct one, move its trades by editing them, and delete the other ([§7.4](07-investments.md#74-securities)). |
| Showing an oversold position | A (security, account) whose running quantity has **ever** been negative gets no holding row and no derived figures — average cost, invested, gain and the **realised gain on every sale in it** are all undefined ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)) — and that holds whether it is still in deficit or was brought back above zero by a later purchase, since the cost basis does not recover ([§11.1](11-calculations.md#111-weighted-average-cost)). The two totals that would have summed those sales say how many they left out rather than counting them as zero ([§3.1](03-portfolio.md#31-behaviour), [§7.3](07-investments.md#73-sales)). Checks 8 and 9 name the trade instead ([§2](02-domain-model.md), [§9](09-checks.md)). |
| Re-validating a file on open | Validation is for the forms ([§13](13-validation.md)). |

---

## Why it is this way

- **Currency** is a version of its own: a second one needs a rate table and a decision at every total about what is being added to what — and a one-valued field stored in advance would not have bought that version anything.
- **Another tax system** is a change to [§11.3](11-calculations.md#113-hypothetical-liquidation) alone, since the rate is already a parameter on the instrument; anything beyond that is future work.
- **Bulk import of trades** is declined because pasting is for bank exports, which arrive by the hundred every month ([§5.7](05-transactions.md#57-bulk-import)). Trades arrive a few dozen a year, one confirmation at a time, and each one carries a security that may not exist yet — the paste would need a column for that too, and a way to say what to do when it does not match.
- **Bulk import of payslips** is the same reasoning, more so: a dozen a year, ten fields each, and no export to paste from — a payslip is read off a PDF by eye whatever the application offers.
- **Category groups** would add a concept for no gain.
- **Automatic generation between trades and transactions** is refused because the independence of the two sources is what makes the checks meaningful.
- **A warning tier** would become a place for things to sit unfixed.
- **Bulk edit** is refused because rules do the same job repeatably and leave a reason behind.
- **Transferring a position between brokers** is not modelled, and the two failing checks are the price of not building it.
- **Corporate actions: what was tried, what each attempt breaks, and why deleting the position is the answer.** This is worth recording in full, because “enter it as an adjusting trade” is the obvious idea, it was the earlier answer here, and **it does not work**.
  - **A forward split cannot be entered at all.** A 2-for-1 split wants a purchase of the extra shares at a price of nothing: quantity doubles, `costBasis` is untouched, `avgCost` halves, which is exactly right ([§11.1](11-calculations.md#111-weighted-average-cost)). But `unitPrice` must be **greater than zero** ([§13](13-validation.md)), so the trade the arithmetic wants is the one trade the form refuses. Entering `0,0001` instead is not a workaround: it puts a small error into the cost basis of a position that is then wrong for as long as it is held, and silently.
  - **A reverse split is worse, and has no workaround.** It wants shares taken *away*, and the only record that removes shares is a sale — which does `costBasis −= q × avgCost` ([§11.1](11-calculations.md#111-weighted-average-cost)). A 1-for-10 reverse split entered that way destroys nine tenths of the cost basis, so the position looks as though it cost a tenth of what it did, and every figure derived from it is wrong in the flattering direction. It also books a **realised loss of nearly the whole position** ([§11.2](11-calculations.md#112-realised-gain-on-a-sale)), which is a fact about nothing that happened and lands in the all-time card on Portfolio ([§3.1](03-portfolio.md#31-behaviour)), the one figure on that screen that is supposed to be a record rather than an estimate.
  - **Selling everything and buying it back has the same defect in a more expensive form**: it invents a realised gain for the whole position, and it leaves checks 6 and 7 with two trades and no bank transactions to pair them against ([§9](09-checks.md)).
  - **So the position is deleted and re-entered.** The realised gain on the sales that are deleted goes with them, which is the cost and is stated here rather than discovered later: a position that had sales before the event loses their contribution to the all-time figure. Everything after the event is then ordinary. It is a handful of edits, for something that happens to one holding every few years, and it is the only route that leaves no wrong number behind.
  - **Relaxing `unitPrice > 0` was considered and declined.** It would make a forward split enterable and would still leave a reverse split with no representation, so it buys half a case at the cost of a validation rule that currently means something simple and true — a trade happened at a price. The whole feature is one version's work when it is wanted: an adjustment record that scales quantity and leaves the basis alone is what a split actually is, and it is not a trade.
- **Merging two securities** is a handful of edits for something that happens once.
- **An oversold position is not shown** because there is no reading of its figures that would be true, and checks 8 and 9 are the report the situation actually calls for.
- **A file is not re-validated on open** because the migration script is written once, for one file, by the one person who will run it.
- **The import stays strict about shape, and infers nothing at all.** What a row's characters mean is said by three controls the user can see and move ([§5.7](05-transactions.md#57-bulk-import)), and anything that does not fit what they say is reported as a row that cannot be read rather than guessed at. The two decorations that *are* read — a leading `+` and a `€`/`EUR` marker — are the two that cannot be mistaken for anything else, and a fourth column is tolerated because ignoring it cannot misread anything.

---

[← §14 Empty and error states](14-empty-and-error-states.md)
