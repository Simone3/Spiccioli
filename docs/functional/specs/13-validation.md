# §13 — Validation

*[Index](../README.md) · no mockups for this section*

What the forms refuse. Everything here is enforced at the point of entry, by the field or by the save; nothing here is a check ([§9](09-checks.md)). The division is: a **rule about one record in isolation** is a validation and is prevented, while a **rule about how two records relate** is a check and is reported. That is why a trade cannot have a negative quantity but can sell more than was ever bought.

**Four families of rule cross that line and are prevented anyway. They are the exceptions, and there are no others** — every other two-record rule in the application is a check.

- **Uniqueness** — institution name, account name within its institution, contract name, security ISIN.
- **Deletion refused while something points at the record.**
- **The two locks** — an account's `type` **across the cash/brokerage boundary** once it holds anything, and a trade's `kind` once it exists.
- **A contract's dates and its payslips must agree, and it is enforced from both sides** — a payslip's month must fall inside the contract's life, and the contract's dates cannot be narrowed past a payslip or a ContractYear that already exists.

**What a reference is allowed to point at is not on this list, because nothing is refused.** A transaction's account picker holds cash accounts and no others, a trade's holds brokerage accounts, a rule's category picker holds real categories: the wrong kind of record is never offered, so there is no invalid choice to reject and no message to write ([§2](02-domain-model.md), [§9](09-checks.md)).

---

## 13.1 How it behaves

- **Invalid input is refused as it is typed**, not on save, wherever the field can tell: letters in an amount, a thirteenth month, a fifth decimal. What cannot be judged until the whole form is known — a required field left empty, a duplicate name — marks the field and disables the save button, with the reason beside the field.
- **Never a modal.** The message sits where the offending value is ([§14](14-empty-and-error-states.md)).
- In an **inline edit**, a refused value keeps the cell open and the previous value in force. The row is never left half-changed.
- **Text is trimmed on save**, everywhere, and a field that trims to nothing counts as empty. Interior whitespace is left alone — bank descriptions carry it and rules match on it.
- **`notes` is optional on every entity that has one**, trimmed like any other text, of no bounded length, and read by nothing in the application ([§5.1](05-transactions.md#51-columns)).
- **An imported row is validated exactly as a typed one.** A pasted row whose date does not parse under the import's date control, **whose date is in the future**, whose amount does not parse under its two separator controls, or whose description is empty after trimming **cannot be read**, is marked with the reason and cannot be ticked ([§5.7](05-transactions.md#57-bulk-import)). **There is no value the form refuses that a paste can nevertheless put in the file.** **A zero amount is not one of them** — it is legal on both paths, and an import that met one would bring it in.
- **Once the import's three controls have said what a row's characters mean, the paste and the form admit exactly the same values.** A typed `1234` and a pasted `1234` are both `€ 1.234,00`; a third decimal is refused on both paths. The one asymmetry runs the harmless way: the amount field will not accept a thousands separator at all, while a paste may carry them, since a field knows there is none in play and a bank export does not say so until the control does.
- **Every monetary field in the application is the same field.** One control, used wherever an amount is entered — opening balance, transaction amount, fee, tax, sell fee, every figure on a payslip: **at most two decimals**, digits and at most one decimal separator, nothing else typeable. Whether it accepts a sign and whether zero is allowed vary by field and are stated below; the shape never does. A price and a quantity are the two exceptions and carry **four** decimals ([§11](11-calculations.md)).
- **The decimal character the field accepts is the one `decimalSeparator` names** ([§10](10-settings.md)). With the preference at `,` a `.` is simply not typeable in an amount, and a thousands separator is not typeable under either setting. Changing the preference changes which key produces the separator and nothing else: no stored figure moves, and no figure already entered is re-read.
- **There is no currency field, on any form or in any record.** Every amount is EUR ([§1](01-premise-and-constraints.md)), so there is nothing to choose, nothing to validate and nothing that could be set wrong.
- **The rules on this page are not re-applied on open.** Two different questions are asked at two different moments. **Is this file something the application understands?** — its schema version, its shape, whether it holds a category, role or field this version has never heard of — is asked on open, and a file that fails it is not opened at all ([§12](12-storage.md)). **Is this value one a person could have typed?** is the subject of this section, and it is asked at the point of entry and nowhere else. A file may therefore be perfectly readable and still hold a payslip with a gross of zero: the application shows it faithfully and the checks complain about it.

## 13.2 The rules

### Institution

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique. |
| defaultSellFee | Amount field, required, ≥ 0. Empty is not zero — type the zero. |
| delete | Refused while any account points at it, closed accounts included. The message names the accounts. |

### Account

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique **within its institution**, and unique among the accounts that have none. Two *Conto Corrente* at different banks are fine and normal; two at the same bank are a mistake. |
| institutionId | **Required on every type but `Liquidity`**, where *None* is offered and means physical cash. Switching the type to one that requires it marks the field. |
| type | Required. **The five cash types are freely interchangeable at any time**; only the boundary between them and `Brokerage` is locked, and only once the account holds a transaction or a trade. To move an account across that boundary: empty it, or delete it and record it again. |
| openingBalance | Amount field, required, any sign. **Forced to 0 and disabled on `Brokerage`** ([§2](02-domain-model.md)). |
| exitTaxRate | **Only on `Pension fund`**, where it is required; **empty and disabled on every other type**, and switching the type away from `Pension fund` clears it. Entered and shown as a percentage, 0 – 100 with at most 1 decimal, stored as the fraction it names, exactly as `Security.taxRate` below. **Pre-filled with 15,0** ([§4.3](04-accounts.md#43-creating-and-editing)). |
| openingDate | Required. **Not in the future.** |
| closingDate | Optional; must be ≥ `openingDate` and, like it, **not in the future**. Nothing else is required to close an account — check 11 reports what was left in it ([§9](09-checks.md)). |
| delete | Refused while any transaction or trade points at it. Closing is what retiring looks like ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Transaction

| Field | Rule |
| --- | --- |
| accountId | Required. The picker lists **cash accounts only**; a brokerage account can never be chosen, here or on an import. **Closed accounts are listed**, marked and after the open ones ([§4.3](04-accounts.md#43-creating-and-editing)). |
| date | Required, date picker. **Not in the future** — the picker offers no day after today, on the form and in an inline edit alike. A pasted row dated ahead cannot be read ([§5.7](05-transactions.md#57-bulk-import)). No bound against the *account's* dates — check 12 reports those. |
| description | Required, trimmed, non-empty. It is the only thing a rule matches on. |
| amount | Amount field, required, either sign. **Zero is legal.** Empty still blocks the save: zero is a value that was typed, empty is a field that was not. |
| categoryId | **Either a category or *Automatic* — never nothing.** The picker offers no clearing entry, so a `manual` row always carries a category and the only empty category in the file is one no rule matched ([§2](02-domain-model.md)). |
| receiptState | One of the three values, never empty. Defaults to `na` and is **set by hand and by nothing else** — on the add-transaction form as the row is created ([§5.5](05-transactions.md#55-add-transaction)), or on the row afterwards. A row created any other way starts `na` ([§6.3](06-categories.md#63-category-list)). |

### Trade

| Field | Rule |
| --- | --- |
| kind | Required, `purchase` or `sale`. Not a field on the form — it is which tab the trade was recorded from ([§7.2](07-investments.md#72-purchases), [§7.3](07-investments.md#73-sales)) — and it is **locked once the trade exists**. Deleting the row and recording it again is how a purchase becomes a sale. |
| accountId | Required. The picker lists **brokerage accounts only**, closed ones included and marked ([§4.3](04-accounts.md#43-creating-and-editing)). |
| securityId | Required — chosen from the existing list or created inline ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)). |
| date | Required, date picker. **Not in the future**, exactly as for a transaction. No bound against the *account's* dates — check 12 reports those. |
| quantity | Required, > 0, at most 4 decimals. Direction is `kind`, never a negative quantity. |
| unitPrice | Required, > 0, at most 4 decimals. |
| fees | Amount field, required, ≥ 0. |
| taxes | Amount field, required on a sale, ≥ 0. **Forced to 0 and disabled on a purchase.** Never pre-filled from the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation). |
| oversell | **Not validated.** A sale of more than has been bought is saved and reported by checks 8 and 9 ([§13.1](#131-how-it-behaves), [§9](09-checks.md)). |

### Security

| Field | Rule |
| --- | --- |
| isin | Required, unique, 12 characters, two letters then nine alphanumerics then a digit. The format is checked; the check digit is not recomputed. |
| ticker, name | Required, trimmed. |
| type | Required, one of the five of [§2](02-domain-model.md). Freely editable afterwards. |
| taxRate | Required. **Entered and shown as a percentage**, 0 – 100 with at most 1 decimal, and stored as the fraction it names — 12,5 is typed and `0,125` is kept ([§11](11-calculations.md)). |
| delete | Refused while any **trade** points at it. Prices are not dependent data — they go with the security, and deleting it deletes its price history in the same breath, the confirmation saying how many records that is. |

### Price

| Field | Rule |
| --- | --- |
| date | Required. **Not in the future** — a price is a fact about a day that has happened. |
| value | Required, > 0, at most 4 decimals. |
| collision | **Never asked about in an editor.** Saving onto a day that already has a price replaces it, and moving a record onto an occupied day does the same ([§2](02-domain-model.md), [§7.4](07-investments.md#74-securities)). **The editor shows the value the day currently holds while it is open**, which is what makes the replacement visible without a prompt. A fetch is not an exception to this: it asks nothing per day either, and instead puts **the whole pass** up for one confirmation before writing any of it ([§7.6](07-investments.md#76-prices)). |
| source | **Not a field on any form.** It is set by whatever wrote the record — `fetched` by *Update prices* ([§7.6](07-investments.md#76-prices)), `manual` by every editor and by every user edit of a fetched record, value or date ([§2](02-domain-model.md)). It is shown in the price history of [§7.4](07-investments.md#74-securities) and read by nothing. |

### Contract

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique. |
| monthsPerYear | Required, integer, 1 – 24. |
| hoursPerDay | Required, > 0, ≤ 24, at most 2 decimals. |
| startDate / endDate | Start required; end optional and ≥ start. **Neither may be moved so that an existing payslip or ContractYear falls outside the contract's life** — the same rule that stops a payslip being entered outside it, enforced from the other side. Narrowing is refused while any payslip's `year`/`month` or any ContractYear's `year` would be left outside, and the message names them; widening is always allowed. Delete the payslips or clear the years first, and then the dates will move. |
| delete | Refused while any payslip points at it. Its ContractYear records go with it when it is deleted. |

### ContractYear

| Field | Rule |
| --- | --- |
| workingDays | Integer 1 – 366, **or empty**. Empty is a legitimate state meaning “not entered yet”, and is what makes the hourly columns read *undefined* rather than wrong ([§11.7](11-calculations.md#117-salary-figures)). Zero is refused. |
| the record | **Created by typing into the cell and deleted by emptying it** ([§8.1](08-salaries.md#81-payslips)). Emptying returns the year to exactly the state it had before anything was typed. It is the one delete that is **not confirmed** ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Payslip

| Field | Rule |
| --- | --- |
| contractId | Required. |
| year, month | Required; month 1 – 12. The month must fall **within the contract's start and end dates**. |
| label | Optional, trimmed, not unique. It is what distinguishes a second payslip in a month from the first and what orders the two ([§8.1](08-salaries.md#81-payslips)); nothing reads it but the eye. |
| gross, contractGross | Amount fields, required, > 0. |
| netPayment | Amount field, required, ≥ 0. |
| refunds, carPayment | Amount fields, required, ≥ 0. These are magnitudes; the formula of [§11.7](11-calculations.md#117-salary-figures) applies their signs. |
| employeeContribution, employerContribution, severanceContribution | Amount fields, required, ≥ 0. Magnitudes, and **zero is the ordinary value for a heading the payslip has nothing under** — it expects no credit and takes no part in check 5 ([§11.6](11-calculations.md#116-derived-matching)). |

### Rule

| Field | Rule |
| --- | --- |
| substring | Required, trimmed, at least 2 characters. |
| categoryId | Required, and a real category — *Automatic* is not offered. |
| duplicates | A substring already used by an earlier rule is **allowed but flagged** on the row itself, and again in the apply summary, where it accounts for nothing ([§6.2](06-categories.md#62-rules)). |
| the draft | Nothing in a rule editing session reaches the file until *Apply changes* is confirmed, and a draft that cannot be applied — a rule with no substring, or none with a category — marks the offending row and disables the button, exactly as any other form does ([§6.2](06-categories.md#62-rules)). |

### Preferences

| Field | Rule |
| --- | --- |
| priceStalenessDays, pensionRevaluationMonths, receiptPendingMonths | Integer ≥ 1. |
| transferMatchWindowDays, tradeMatchWindowDays | Integer 0 – 31. Zero means same day only. |
| backupCount | Integer 1 – 100. |
| defaultTaxRate | 0 – 100, at most 1 decimal, entered as a percentage and stored as a fraction, exactly as `Security.taxRate` above. |
| dateFormat, decimalSeparator | Pickers over the closed sets of [§10](10-settings.md). There is nothing to reject: the only values offered are the legal ones. |
| thousandsSeparator | The same, plus **none**, which is a value rather than an empty field. |
| separators | Decimal and thousands separators must differ; choosing the decimal separator's character as the thousands one is refused in place, leaving the previous value in force. **None** never collides. |

### Bulk import

| Field | Rule |
| --- | --- |
| account | Required before anything can be imported. |
| date format, decimal separator, thousands separator | Pickers over the same closed sets as the preferences of the same name ([§10](10-settings.md)), each opening at that preference's current value. There is nothing to reject: the only values offered are the legal ones. Decimal and thousands **must differ**, refused in place with the previous value left in force, exactly as on Settings; **none** never collides. They apply to this paste only and are written nowhere ([§5.7](05-transactions.md#57-bulk-import)). |
| selection | *Import* is disabled while no account is chosen or nothing is ticked, and by nothing else. An unreadable row can never be ticked; **every other row is freely selectable**, a flagged duplicate included — the flag unselects it, it does not lock it ([§5.7](05-transactions.md#57-bulk-import)). |

---

## Why it is this way

- **Why the four exceptions are prevented rather than reported.**
  - **Uniqueness:** the damage is to the pickers, and it is immediate — two identical entries in a list the user is about to choose from cannot be told apart, so the next record is misfiled by a form that offered no way to get it right. A check would report the collision after everything chosen in between had already gone to the wrong one of the two.
  - **Deletion with dependents:** the alternative is not a reported inconsistency but a dangling reference — a transaction on an account that no longer exists. The file has no state for that and no screen could render it.
  - **The two locks:** both would silently restate records already written rather than correct the one in front of the user — a cash account turned brokerage orphans every row on it, a purchase turned sale reverses a position. Deleting and re-entering is the honest way to do either, and it is available. Note how narrow the account lock is: the five cash types stay interchangeable forever. For four of them nothing at all is derived from which one an account is — a current account recorded as `Liquidity` that should have been a `Deposit account` is a slice in the wrong place on one screen ([§3.1](03-portfolio.md#31-behaviour)) and nothing else. **`Pension fund` is the one that carries a consequence**, since it is the type that takes an exit tax off the balance ([§11.3](11-calculations.md#113-hypothetical-liquidation)); moving an account into it asks for a rate, moving one out clears it, and both are visible on the form as it happens and reversible by setting the type back. That is a correction the user can see, which is what separates it from the two locks above, where the record being restated is not the one in front of them.
  - **Contract dates against payslips:** both records are on screen as it is typed — the contract is the selector scoping the whole screen ([§8.1](08-salaries.md#81-payslips)) — so this is not a rule about a record the user has not reached yet. A payslip from before you were hired is always a typo, never a half-entered state on the way to something. Enforcing only the first direction would have left the second as the way around it: the same file state, reached by editing the contract instead of the payslip, and reached silently, since the per-year table is built from the contract's dates and would simply stop showing the years it had orphaned.
- **The thread through all four is that the counterpart record is already chosen, already on screen, and not going to arrive later.** Where that is not true — a trade whose funding transaction has not been entered yet, a transfer whose second leg comes with next month's export, a sale whose purchase is further down the pile of confirmations — the rule is a check, because a form that refuses those is a form blocked by a record the user is on their way to entering. That is also why an oversell is saved: refusing it would mean a form that can be blocked by a record the user has not reached yet, on the one screen where trades are entered in whatever order the confirmations came out of the envelope.
- **Offering only valid choices is the general shape of every rule here that could have been a refusal and is instead an absence.**
- **`notes` is stated once here instead of in nine tables**, being the one field with no rule of its own.
- **The paste and the form admit the same values because the paste is no longer guessing.** The earlier design required two decimals on every pasted amount, which was the price of inferring the separator from the digits; with the separators declared on the import screen there is nothing to infer, so the requirement bought nothing and cost a reshaped export on every import ([§5.7](05-transactions.md#57-bulk-import)). What guards the column now is the grouping rule: a thousands separator that does not fall in threes, or one present when the control says none, is a row that cannot be read rather than a figure out by a factor of a thousand.
- **There is no currency field** because a picker with one entry would have been a control that can only be confirmed, on two forms, read by nothing — and the version that adds a second currency has to revisit every total in [§11](11-calculations.md) regardless, which a field stored in advance does not help with ([§15](15-out-of-scope.md)).
- **The field rules are not re-run on open** because they exist to stop a person mistyping, not to defend against a malformed file: the ten years of history arrive through a one-off migration script written for this file alone ([§12](12-storage.md)), and a script that writes something the forms would have refused has produced data the application will show faithfully and the checks will complain about. That is the intended outcome.
- **An institution's sell fee has no empty state** so that a fee of nothing is a fee that was typed.
- **Two accounts at one bank may not share a name** because two identical rows in a picker are indistinguishable; two *Conto Corrente* at different banks are not.
- **An account requires an institution unless it is `Liquidity`** because a deposit, a term deposit, a pension fund, a voucher balance and a securities dossier are all held *by* somebody, and a brokerage account with no institution could never pair a trade with the money that paid for it ([§11.6](11-calculations.md#116-derived-matching), checks 6 and 7).
- **Opening and closing dates are barred from the future** because an account is opened before it is recorded, not after, and an account closing next month is an account that is still open.
- **A transaction's date is barred from the future** because a ledger records what has happened, and because it is what lets the net worth chart end exactly on the headline figure ([§11.5](11-calculations.md#115-net-worth-over-time)). A trade's date is barred for the same two reasons — it is a confirmation of something that happened, and a position dated ahead would put the chart below the headline it ends at.
- **A zero transaction amount is legal** because a card verification, a reversed charge and a fee waived to nothing all post as `0,00`, and refusing them would send the user to invent a figure the bank did not use.
- **A security's type stays freely editable** because it groups the portfolio breakdown ([§3.1](03-portfolio.md#31-behaviour)) and nothing is derived from it, so correcting one restates a slice and no recorded figure.
- **A price collision is never queried** because one price per security per day is the model and the last word on a day wins. A prompt per collision would fire every week, most often where a fetch replaces a value it wrote itself an hour earlier. What replaces it in each case is *visibility* rather than a question: the editor shows the value it is about to overwrite while the new one is being typed, and a fetch shows every value it would overwrite, once, before writing any ([§7.6](07-investments.md#76-prices)).
- **Clearing a working-days cell is the one unconfirmed delete** because nothing is lost but the number in the cell, it is in front of the user as they clear it, and typing it again is the whole of the undo. Zero is refused because it is not a year, it is a division by zero spelled differently.
- **A payslip's label is neither required nor unique** because the ordinary monthly payslip is the one that has none.
- **A rule's substring is at least two characters** because a one-character rule would match most of the file on its first commit, and re-categorisation is immediate ([§6.2](06-categories.md#62-rules)). **A duplicate substring is flagged rather than refused** because the later rule can never fire, and saying so is more useful than refusing it. *Automatic* is not offered as a rule's category since a rule that assigns nothing is not a rule.

---

[← §12 Storage](12-storage.md) · [§14 Empty and error states →](14-empty-and-error-states.md)
