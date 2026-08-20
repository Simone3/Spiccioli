# §14 — Empty and error states

*[Index](../README.md) · [why it is this way](../why/14-empty-and-error-states.md) · no mockups for this section*

A file starts empty and stays that way for a while. Every screen therefore has a state with no data behind it, and every one of them says what to do next rather than showing a blank card.

---

## 14.1 The rules

- **An empty screen names the action that fills it**, as a sentence and a button that goes there — never an empty table with headers, never the word “No data”.
- **Empty because of a filter is a different state** from empty because nothing exists. The first says which filter is hiding the rows and offers to clear it; the second is the state above.
- **A zero is not an empty state.** An account with a € 0,00 balance, a category with no transactions this year, a check that passed — all of these render normally.
- **Errors are shown where the thing failed** and never as a modal that has to be dismissed before the application can be used. **Exactly two things block, and both are about the file rather than about the work**: a file that cannot be read, which never gets past the launch screen ([§12.1](12-storage.md#121-the-launch-screen)), and a file that cannot be **written** after five attempts, which blocks with a *Retry* ([§12](12-storage.md)). Everything else — a refused value, a failed fetch, an unreadable pasted row — is reported in place and leaves the application working.

## 14.2 Per screen

| Screen | Empty state | Error state |
| --- | --- | --- |
| Portfolio | No accounts: “Nothing here yet — add the accounts you want to track.” with a button to Accounts. Accounts but no transactions: the table renders with opening balances and the charts say they need history. | — |
| Accounts | No accounts: “Add the first account — a current account is the usual place to start,” with the button. | A delete refused because something depends on the record says what depends on it ([§13](13-validation.md)). |
| Accounts › Institutions | No institutions: “Only a Cash account does without one — that is what physical cash is. Add one when a bank turns up,” with the *Add institution* button, which is the only way one is created ([§4.2](04-accounts.md#42-institutions)). | A delete refused because accounts point at the institution names them ([§13](13-validation.md)). |
| Transactions | No transactions: “Import a bank export, or add a row by hand,” with both buttons. Filtered to nothing: “No transaction matches these filters,” with *Clear filters*. | A form that cannot be saved states why beside the offending field and disables *Save*; the row is never left half-changed ([§13](13-validation.md)). |
| Bulk import | Empty paste: the screen explains the three expected columns and shows the account picker and the three format controls at their preference values ([§5.7](05-transactions.md#57-bulk-import)); *Import* stays disabled until an account is chosen and something is selected ([§13](13-validation.md)). | Rows that cannot be read are marked in the preview with the reason and cannot be ticked; the readable rows around them import normally ([§5.7](05-transactions.md#57-bulk-import)). No cash account to import into: the screen points at Accounts. |
| Categories › Report | No categorised transactions: the matrix is replaced by a line saying it fills as transactions are categorised. | — |
| Categories › Rules | No rules: “Nothing is categorised automatically yet — add a rule, then apply the list and see what it would catch,” with the button. A rule that accounts for nothing shows *0 transactions*, which is a result, not an empty state. | An apply summary in which nothing at all would change says so and offers to apply anyway — reordering rules that catch disjoint descriptions is a legitimate no-op ([§6.2](06-categories.md#62-rules)). |
| Categories › Category list | Never empty; the twenty-seven are seeded into every new file ([§6.3](06-categories.md#63-category-list)). | — |
| Investments › Holdings | No trades: “Record a purchase to start tracking holdings,” with the button. Trades but no prices: holdings render at **what they cost** with the price cell reading *none* and inviting a value, and check 3 says why ([§11.3](11-calculations.md#113-hypothetical-liquidation)). | A fetch always ends in the same review, whether it went well or badly: every security in the file with what would be written and over what, which had no quote, which could not be fetched at all with their reasons, which were never asked about, and the provider's reference date ([§7.6](07-investments.md#76-prices)). Confirm and a line says what was written; close and nothing was. A provider that is unreachable altogether is that same page with nothing that can be ticked and the write refused. The rest of the screen works throughout and every known price stays. |
| Investments › Purchases | No purchases: “Record the first purchase — the security can be created with it,” with the button. This is where every holding begins, so it is the one Investments tab whose empty state is an instruction rather than a statement. | A form that cannot be saved states why beside the offending field and disables *Save* ([§13](13-validation.md)). |
| Investments › Sales | No sales: “Nothing has been sold yet,” and the tab keeps its count at zero rather than disappearing. | — |
| Investments › Securities | No securities: “Add one here, or let the first purchase create it,” with *Add security* and a button to the Purchases tab ([§7.4](07-investments.md#74-securities)). A security with no prices: the history panel says so and offers the first one. | A delete refused because trades point at the security says how many. **Prices never refuse it** — they belong to the security and go with it, and the confirmation says how many records that is ([§7.4](07-investments.md#74-securities), [§13](13-validation.md)). |
| Salaries › Payslips | No contract: “Add the contract first,” with a button to the Contracts tab. Contract but no payslips: the tables render with headers and a prompt to add one. A year with no working days: an empty cell and two *undefined* hourly figures ([§11.7](11-calculations.md#117-salary-figures)). | — |
| Salaries › Contracts | No contracts: “Add the employer, its months per year and its hours per day — everything on the other tab divides by them.” | — |
| Checks | Never empty. A check with nothing to examine **passes and says so** — “0 payslips” — which is why every passing check states its reach ([§9](09-checks.md)). A failing one names at most five records and says how many there are — *showing 5 of 212* — which is a full state, not a truncated one ([§9](09-checks.md)). | — |
| Settings | Never empty; every preference has a default ([§10](10-settings.md)). | A value that cannot be applied is rejected in place, leaving the previous one in force. |
| Launch | No recent files: only *New file…* and *Open…*. | File missing, unreadable, written by a newer schema version, or carrying something unrecognised: stated on the launch screen, with the other files still openable. A file written by an *older* version is not an error — it asks for confirmation to upgrade, naming both versions and the backup taken first ([§12.1](12-storage.md#121-the-launch-screen)). One of the two places an error blocks a screen. |
| Every screen | — | **A write that failed** is the error no screen owns, so it appears on whichever one is in front of the user: a line while it is being retried, saying the file could not be written and the work is safe in memory, and after five failures a blocking message naming the file, the reason and a *Retry* ([§12](12-storage.md)). The save state in the sidebar carries the same two states ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)). This is the other place an error blocks. **A backup that failed is the same shape and never blocks**: a banner naming the file and the reason, on whichever screen is in front of the user, or in the external-modification line and the upgrade dialog where those are already speaking ([§12](12-storage.md)). |

---

[← §13 Validation](13-validation.md) · [§15 Out of scope →](15-out-of-scope.md)
