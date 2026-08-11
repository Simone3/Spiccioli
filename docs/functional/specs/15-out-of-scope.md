# §15 — Out of scope for v1

*[Index](../README.md) · no mockups for this section*

Each of these was raised and deliberately declined. They are listed so they are not reintroduced by
accident.

---

| Not building | Why |
| --- | --- |
| Multi-currency conversion | Everything is EUR. Currency is recorded, never converted. |
| A second interface language | English only, no language selector. Strings stay separable so it remains possible ([§1](01-premise-and-constraints.md)). |
| Tax systems other than the Italian one | Rate per security is a parameter, not a constant; anything more is future work ([§11.3](11-calculations.md#113-hypothetical-liquidation)). |
| Export in any format | The file is the data, and [§12](12-storage.md) documents it well enough to read with a script. No CSV, no report export. |
| Accessibility work and keyboard shortcuts | Not designed for v1. Dark theme, mouse-first, one user. |
| Editing the category list at runtime | Categories are stored records with stable ids ([§2](02-domain-model.md)), but the application seeds them and offers no editor. |
| Undo / redo | Backups and delete confirmation cover it for now. |
| Bank-specific import profiles | One fixed column order; the user pre-formats the export. Explicitly future work. |
| Bank exports in any other shape | Trailing-sign negatives (`54,80-`), parenthesised negatives, a separate debit/credit column pair, a `D`/`C` marker and a header row are none of them parsed. Three columns, fixed order, one signed amount ([§5.7](05-transactions.md#57-bulk-import)): reshape the export before pasting, and anything that does not fit is reported as a row that cannot be read rather than guessed at. |
| Term-deposit maturity | Not tracked. A term deposit carries no maturity date and nothing announces one — the date goes in the account's notes if it is wanted, and the bank is what tells you the money has moved. |
| A migration importer | A one-off custom script will load the Excel history. |
| Category groups | The list is readable flat; grouping adds a concept for no gain. |
| Monthly reports | Yearly only. |
| Voucher expiry | Not tracked. |
| Automatic transaction generation from trades, or paired transfer entry | The independence of the two sources is what makes the checks meaningful. |
| A warning tier on checks | Pass or fail only ([§9](09-checks.md)). A middle state becomes a place for things to sit unfixed. |
| Mobile or web deployment | Desktop on macOS, Windows and Linux ([§1](01-premise-and-constraints.md)), single machine. |
| Percentage or tiered sell fees | Flat per institution. |
| Sortable columns | Fixed chronological order everywhere; filters narrow instead. |
| Bulk edit of transactions | Bulk *delete* exists ([§5.6](05-transactions.md#56-selecting-and-deleting-in-bulk)). Changing many categories at once is what rules are for, and they leave a reason behind. |
| Transferring a position between brokers | Not modelled. Recorded as a sale and a purchase, which invents a realised gain and leaves checks 6 and 7 with no bank transaction to pair — both failures are visible and are the price of not building it. |
| Corporate actions — splits, mergers, ISIN changes | Not modelled. A split is entered by hand as an adjusting trade, or the security is replaced and the history restarted. |
| Attributing dividends and coupons to a holding | They arrive as ordinary transactions under *Interest, dividends & bonuses* and stay there. A holding's gain is therefore price only, never total return — the income is counted, just not against the instrument that produced it. |
| Merging two securities | A mistyped ISIN entered twice produces two securities and two half-holdings. The fix is to correct one, move its trades by editing them, and delete the other ([§7.4](07-investments.md#74-securities)) — a handful of edits for something that happens once. |
| Re-validating a file on open | Validation is for the forms ([§13](13-validation.md)). The migration script is written once, for one file, by the one person who will run it. |

---

[← §14 Empty and error states](14-empty-and-error-states.md)
