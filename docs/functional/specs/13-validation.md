# §13 — Validation

*[Index](../README.md) · [why it is this way](../why/13-validation.md) · no mockups for this section*

What the forms refuse. Everything here is enforced at the point of entry, by the field or by the save; nothing here is a check ([§9](09-checks.md)). The division is: a **rule about one record in isolation** is a validation and is prevented, while a **rule about how two records relate** is a check and is reported. That is why a trade cannot have a negative quantity but can sell more than was ever bought.

**Four families of rule cross that line and are prevented anyway. They are the exceptions, and there are no others** — every other two-record rule in the application is a check.

- **Uniqueness** — institution name, account name within its institution, contract name, security ISIN.
- **Deletion refused while something points at the record.**
- **The two locks** — an account's `type` **across the cash/brokerage boundary**, from the moment the account exists, and a trade's `kind` once it exists.
- **A contract's dates and its payslips must agree, and it is enforced from both sides** — a payslip's month must fall inside the contract's life, and the contract's dates cannot be narrowed past a payslip or a ContractYear that already exists.

**What a reference is allowed to point at is not on this list, because nothing is refused.** A transaction's account picker holds cash accounts and no others, a trade's holds brokerage accounts, a rule's category picker holds real categories: the wrong kind of record is never offered, so there is no invalid choice to reject and no message to write ([§2](02-domain-model.md), [§9](09-checks.md)).

---

## 13.1 How it behaves

- **Invalid input is refused as it is typed**, not on save, wherever the field can tell: letters in an amount, a thirteenth month, a fifth decimal. What cannot be judged until the whole form is known — a required field left empty, a duplicate name — marks the field and disables the save button, with the reason beside the field.
- **Never a modal.** The message sits where the offending value is ([§14](14-empty-and-error-states.md)).
- **A record is only ever changed by a form.** No table cell in the application is edited where it sits, so there is no half-changed row to reason about: a form that cannot be saved is not saved, and abandoning one leaves the record exactly as it was ([§5.4](05-transactions.md#54-editing), [§7.2](07-investments.md#72-purchases)).
- **Text is trimmed on save**, everywhere, and a field that trims to nothing counts as empty. Interior whitespace is left alone — bank descriptions carry it and rules match on it.
- **`notes` is optional on every entity that has one**, trimmed like any other text, of no bounded length, and read by nothing in the application ([§5.1](05-transactions.md#51-columns)).
- **An imported row is validated exactly as a typed one.** A pasted row whose date does not parse under the import's date control, **whose date is in the future**, whose amount does not parse under its two separator controls, or whose description is empty after trimming **cannot be read**, is marked with the reason and cannot be ticked ([§5.7](05-transactions.md#57-bulk-import)). **There is no value the form refuses that a paste can nevertheless put in the file.** **A zero amount is not one of them** — it is legal on both paths, and an import that met one would bring it in.
- **Once the import's three controls have said what a row's characters mean, the paste and the form admit exactly the same values.** A typed `1234` and a pasted `1234` are both `€ 1.234,00`; a third decimal is refused on both paths. The one asymmetry runs the harmless way: the amount field will not accept a thousands separator at all, while a paste may carry them, since a field knows there is none in play and a bank export does not say so until the control does.
- **Every monetary field in the application is the same field.** One control, used wherever an amount is entered — opening balance, transaction amount, fee, tax, sell fee, every figure on a payslip: **at most two decimals**, digits and at most one decimal separator, nothing else typeable. Whether it accepts a sign and whether zero is allowed vary by field and are stated below; the shape never does. A price is the one exception and carries **four** decimals, and a quantity carries **six** ([§11](11-calculations.md)).
- **No amount field has an upper bound, and that is a decision rather than an omission.** Any ceiling this document named would be a number invented here — large enough to be useless as a check on a typo, small enough to one day refuse a figure that is simply true. What catches a misplaced digit is not a bound but the screens: a transaction three orders of magnitude out moves the footer total, the report cell and net worth on the same pass, and every one of those is read. The decimal rules are the only shape constraint, and they are the ones that catch the mistake a keyboard actually makes.
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
| institutionId | **Required on every type but `Cash`**, where the field is **disabled**, shows *None* and holds nothing. The picker itself offers the recorded institutions and nothing else: *None* is a disabled state, never an entry in the list. Switching the type to `Cash` clears the field; switching away from it re-enables the field empty and marks it ([§4.3](04-accounts.md#43-creating-and-editing)). |
| type | Required. **The seven cash types are freely interchangeable at any time**; the boundary between them and `Brokerage` is **locked from the moment the account exists**, empty or not. `Brokerage cash` is on the cash side of that boundary, its name notwithstanding ([§2](02-domain-model.md)). An account created as `Brokerage` stays a `Brokerage` one and an account created as cash stays cash — the picker offers only the side the account is already on. To move one across that boundary, delete it and record it again. |
| openingBalance | Amount field, required, any sign. **Forced to 0 and disabled on `Brokerage`** ([§2](02-domain-model.md)). |
| exitTaxRate | **Only on `Pension fund`**, where it is required; **empty and disabled on every other type**, and switching the type away from `Pension fund` clears it. Entered and shown as a percentage, 0 – 100 with at most 1 decimal, stored as the fraction it names, exactly as `Security.taxRate` below. **Pre-filled with 15,0** ([§4.3](04-accounts.md#43-creating-and-editing)). |
| openingDate | Required. **Not in the future.** |
| closingDate | Optional; must be ≥ `openingDate` and, like it, **not in the future**. Nothing else is required to close an account — check 11 reports what was left in it ([§9](09-checks.md)). |
| delete | Refused while any transaction or trade points at it. Closing is what retiring looks like ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Transaction

| Field | Rule |
| --- | --- |
| accountId | Required. The picker lists **cash accounts only**; a brokerage account can never be chosen, here or on an import. **Closed accounts are listed**, marked and after the open ones ([§4.3](04-accounts.md#43-creating-and-editing)). |
| date | Required, date picker. **Not in the future** — the picker offers no day after today, on every form that carries a date. A pasted row dated ahead cannot be read ([§5.7](05-transactions.md#57-bulk-import)). No bound against the *account's* dates — check 12 reports those. |
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
| quantity | Required, > 0, at most 6 decimals. Direction is `kind`, never a negative quantity. |
| unitPrice | Required, > 0, at most 4 decimals. |
| fees | Amount field, required, ≥ 0. |
| taxes | Amount field, required on a sale, ≥ 0. **Forced to 0 and disabled on a purchase.** Never pre-filled from the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation). |
| oversell | **Not validated.** A sale of more than has been bought is saved and reported by checks 8 and 9 ([§13.1](#131-how-it-behaves), [§9](09-checks.md)). |

### Security

| Field | Rule |
| --- | --- |
| isin | Required, unique, 12 characters, two letters then nine alphanumerics then a digit. The format is checked; the check digit is not recomputed. |
| ticker | Required, trimmed. **The code the security's `exchange` lists it under** ([§2](02-domain-model.md)), since the two together are what *Update prices* asks the provider for ([§7.6](07-investments.md#76-prices)). **It is not checked against the provider and nothing here contacts the network**: a code no provider carries is a security with no quote available, which is not an invalid security. |
| exchange | Required, one of the eighteen of [§2](02-domain-model.md). Freely editable afterwards, like `ticker` — a listing corrected here is the same instrument, and its price history stays with it. **There is no *none***: every security the model admits is exchange-traded ([§2](02-domain-model.md)). |
| name | Required, trimmed. |
| type | Required, one of the four of [§2](02-domain-model.md). Freely editable afterwards. **There is no `Bond`** ([§15](15-out-of-scope.md)). |
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
| the record | **The one-field form is the record**: saving a number creates it and saving the form empty deletes it ([§8.1](08-salaries.md#81-payslips)). Saving it empty returns the year to exactly the state it had before anything was entered. It is the one delete that is **not confirmed**, everywhere else there being no undo and therefore a confirmation ([§12](12-storage.md)). |

### Payslip

| Field | Rule |
| --- | --- |
| contractId | Required. |
| year, month | Required; month 1 – 12. **Year is a picker over the contract's own years** — the rows of the per-year table ([§8.1](08-salaries.md#81-payslips)) — so no year outside the contract is offerable. The month must fall **within the contract's start and end dates**, which is what a partial first or last year is caught by. |
| label | Optional, trimmed, not unique. It is what distinguishes a second payslip in a month from the first and what orders the two ([§8.1](08-salaries.md#81-payslips)); nothing reads it but the eye. |
| gross, contractGross | Amount fields, required, > 0. |
| netPayment | Amount field, required, **either sign**. Negative is rare and legal — a month whose deductions exceeded its earnings ([§2](02-domain-model.md)). |
| refunds, carPayment | Amount fields, required, ≥ 0. These are magnitudes; the formula of [§11.7](11-calculations.md#117-salary-figures) applies their signs. |
| employeeContribution, employerContribution, severanceContribution | Amount fields, required, ≥ 0. Magnitudes, and **zero is the ordinary value for a heading the payslip has nothing under** — it expects no credit and takes no part in check 5 ([§11.6](11-calculations.md#116-derived-matching)). |

### Rule

| Field | Rule |
| --- | --- |
| substring | Required, trimmed, at least 2 characters. |
| categoryId | Required, and a real category — *Automatic* is not offered. |
| duplicates | A substring already used by an earlier rule is **allowed but flagged** on the row itself, where it reads *0 transactions* once applied: first match wins, so the earlier rule has claimed every row it could match ([§6.2](06-categories.md#62-rules)). |
| the draft | Nothing in a rule editing session reaches the file until *Apply changes* is confirmed, and a draft that cannot be applied — a rule with no substring, or none with a category — marks the offending row and disables the button, exactly as any other form does ([§6.2](06-categories.md#62-rules)). |

### Preferences

| Field | Rule |
| --- | --- |
| priceStalenessDays, pensionRevaluationMonths, receiptPendingMonths | Integer ≥ 1. |
| transferMatchWindowDays, tradeMatchWindowDays | Integer 0 – 31. **The window runs forwards from the leading record** — the sending leg, the trade — so zero means same day only ([§11.6](11-calculations.md#116-derived-matching)). |
| transferMatchBackwardDays | Integer 0 – 31. How many days **before** the sending leg the receiving one may be dated, which is the one backward reach in [§11.6](11-calculations.md#116-derived-matching); zero is the forward-only rule, and there is no trade equivalent. |
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

[← §12 Storage](12-storage.md) · [§14 Empty and error states →](14-empty-and-error-states.md)
