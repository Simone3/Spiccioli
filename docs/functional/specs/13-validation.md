# §13 — Validation

*[Index](../README.md) · no mockups for this section*

What the forms refuse. Everything here is enforced at the point of entry, by the field or by the
save; nothing here is a check ([§9](09-checks.md)). The division is deliberate: a **rule about one
record in isolation** is a validation and is prevented, while a **rule about how two records
relate** is a check and is reported. That is why a trade cannot have a negative quantity but can
sell more than was ever bought.

**Four families of rule cross that line and are prevented anyway. They are listed here because they
are the exceptions, and there are no others** — every other two-record rule in the application is a
check.

| Prevented although it relates two records | Why it is not left to a check |
| --- | --- |
| **Uniqueness** — institution name, account name within its institution, contract name, security ISIN | The damage is to the pickers, and it is immediate: two identical entries in a list the user is about to choose from cannot be told apart, so the next record is misfiled by a form that offered no way to get it right. A check would report the collision after everything chosen in between had already gone to the wrong one of the two. |
| **Deletion refused while something points at the record** | The alternative is not a reported inconsistency but a dangling reference — a transaction on an account that no longer exists. The file has no state for that and no screen could render it. |
| **The two locks** — an account's `type` once it holds anything, a trade's `kind` once it exists | Both would silently restate records already written rather than correct the one in front of the user: a cash account turned brokerage orphans every row on it, a purchase turned sale reverses a position. Deleting and re-entering is the honest way to do either, and it is available. |
| **A payslip's month within its contract's start and end dates** | Both records are on screen as it is typed — the contract is the selector scoping the whole screen ([§8.1](08-salaries.md#81-payslips)) — so this is not a rule about a record the user has not reached yet. A payslip from before you were hired is always a typo, never a half-entered state on the way to something. |

The thread through all four is that the counterpart record is **already chosen, already on screen,
and not going to arrive later**. Where that is not true — a trade whose funding transaction has not
been entered yet, a transfer whose second leg comes with next month's export, a sale whose purchase
is further down the pile of confirmations — the rule is a check, because a form that refuses those
is a form blocked by a record the user is on their way to entering.

**What a reference is allowed to point at is not on this list, because nothing is refused.** A
transaction's account picker holds cash accounts and no others, a trade's holds brokerage accounts, a
rule's category picker holds real categories: the wrong kind of record is never offered, so there is
no invalid choice to reject and no message to write ([§2](02-domain-model.md),
[§9](09-checks.md)). That is the general shape of every rule here that could have been a refusal and
is instead an absence.

---

## 13.1 How it behaves

- **Invalid input is refused as it is typed**, not on save, wherever the field can tell: letters in
  an amount, a thirteenth month, a fifth decimal. What cannot be judged until the whole form is
  known — a required field left empty, a duplicate name — marks the field and disables the save
  button, with the reason beside the field.
- **Never a modal.** The message sits where the offending value is
  ([§14](14-empty-and-error-states.md)).
- In an **inline edit**, a refused value keeps the cell open and the previous value in force. The
  row is never left half-changed.
- **Text is trimmed on save**, everywhere, and a field that trims to nothing counts as empty.
  Interior whitespace is left alone — bank descriptions carry it and rules match on it.
- **`notes` is optional on every entity that has one**, trimmed like any other text, of no bounded
  length, and read by nothing in the application ([§5.1](05-transactions.md#51-columns)). It is the
  one field with no rule to state, which is why it is stated once here instead of in nine tables.
- **An imported row is validated exactly as a typed one.** Bulk import is another way into the same
  record, not a side door around these rules: a pasted row whose date does not parse, **whose date is
  in the future**, whose amount does not parse, or whose description is empty after trimming
  **cannot be read**, is marked with the reason and cannot be ticked
  ([§5.7](05-transactions.md#57-bulk-import)). **There is no value
  the form refuses that a paste can nevertheless put in the file**, which is the direction that
  matters. **A zero amount is not one of them** — it is legal on both paths, and an import that met
  one would bring it in.
- **The paste is stricter than the form in one respect, deliberately.** A typed `1234` is a perfectly
  good amount and means `€ 1.234,00`, while a pasted `1234` cannot be read at all
  ([§5.7](05-transactions.md#57-bulk-import)): the field knows there is no thousands separator in
  play because it is the one that just refused to accept one, and a pasted column does not. Strictness
  in that direction costs a reshaped export and buys a column that can never be misread by a factor
  of a thousand.
- **Every monetary field in the application is the same field.** One control, used wherever an
  amount is entered — opening balance, transaction amount, fee, tax, sell fee, every figure on a
  payslip: **at most two decimals**, digits and at most one decimal separator, nothing else typeable.
  Whether it accepts a sign and whether zero is allowed vary by field and are stated below; the
  shape never does. A price and a quantity are the two exceptions and carry **four** decimals
  ([§11](11-calculations.md)).
- **`currency` is a picker with one entry.** It is required, present on the account and security
  forms, and offers `EUR` and nothing else in v1 ([§1](01-premise-and-constraints.md)). It exists as
  a field because the model records it ([§2](02-domain-model.md)) and because the day a second one
  appears it must be a value that was always stored, not a column added to ten years of records that
  never had it. It is not disabled — a picker with one choice reads as a fact about the file, and a
  greyed one reads as something broken.
- **The rules on this page are not re-applied on open**, and that is not the same thing as opening a
  file without looking at it. Two different questions are asked at two different moments. **Is this
  file something the application understands?** — its schema version, its shape, whether it holds a
  category, role or field this version has never heard of — is asked on open, and a file that fails
  it is not opened at all ([§12](12-storage.md)). **Is this value one a person could have typed?** is
  the subject of this section, and it is asked at the point of entry and nowhere else. A file may
  therefore be perfectly readable and still hold a payslip with a gross of zero: the application
  shows it faithfully and the checks complain about it.
- **The field rules are not re-run on open.** They exist to stop a person mistyping, not to
  defend against a malformed file: the ten years of history arrive through a one-off migration
  script written for this file alone ([§12](12-storage.md)), and a script that writes something the
  forms would have refused has produced data the application will show faithfully and the checks
  will complain about. That is the intended outcome.

## 13.2 The rules

### Institution

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique. Two institutions with the same name would make every account picker ambiguous. |
| defaultSellFee | Amount field, required, ≥ 0. Empty is not zero — type the zero. |
| delete | Refused while any account points at it, closed accounts included. The message names the accounts. |

### Account

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique **within its institution**, and unique among the accounts that have none. Two *Conto Corrente* at different banks are fine and normal; two at the same bank are a mistake. |
| institutionId | **Required on every type but `Liquidity`**, where *None* is offered and means physical cash. A deposit, a term deposit, a pension fund, a voucher balance and a securities dossier are all held *by* somebody, and a brokerage account with no institution could never pair a trade with the money that paid for it ([§11.6](11-calculations.md#116-derived-matching), checks 6 and 7). Switching the type to one that requires it marks the field. |
| type | Required. **Locked once the account holds anything** — a transaction or a trade. Changing a cash account into a brokerage one would orphan every row on it. |
| openingBalance | Amount field, required, any sign. **Forced to 0 and disabled on `Brokerage`** ([§2](02-domain-model.md)). |
| currency | Required. `EUR` only in v1 ([§13.1](#131-how-it-behaves)). |
| openingDate | Required. **Not in the future** — an account is opened before it is recorded, not after. |
| closingDate | Optional; must be ≥ `openingDate` and, like it, **not in the future**. An account closing next month is an account that is still open. Nothing else is required to close one — check 11 reports what was left in it ([§9](09-checks.md)). |
| delete | Refused while any transaction or trade points at it. Closing is what retiring looks like ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Transaction

| Field | Rule |
| --- | --- |
| accountId | Required. The picker lists **cash accounts only**; a brokerage account can never be chosen, here or on an import. **Closed accounts are listed**, marked and after the open ones ([§4.3](04-accounts.md#43-creating-and-editing)). |
| date | Required, date picker. **Not in the future** — a ledger records what has happened, and the picker offers no day after today, on the form and in an inline edit alike. It is also what lets the net worth chart end exactly on the headline figure ([§11.5](11-calculations.md#115-net-worth-over-time)). A pasted row dated ahead cannot be read ([§5.7](05-transactions.md#57-bulk-import)). No bound against the *account's* dates — check 12 reports those. |
| description | Required, trimmed, non-empty. It is the only thing a rule matches on. |
| amount | Amount field, required, either sign. **Zero is legal** — a card verification, a reversed charge and a fee waived to nothing all post as `0,00`, and refusing them would send the user to invent a figure the bank did not use. Empty still blocks the save: zero is a value that was typed, empty is a field that was not. |
| categoryId | **Either a category or *Automatic* — never nothing.** The picker offers no clearing entry, so a `manual` row always carries a category and the only empty category in the file is one no rule matched ([§2](02-domain-model.md)). |
| receiptState | One of the three values, never empty. Defaults to `na` and is **set by hand and by nothing else** — on the add-transaction form as the row is created ([§5.5](05-transactions.md#55-add-transaction)), or on the row afterwards. A row created any other way starts `na` ([§6.3](06-categories.md#63-category-list)). |

### Trade

| Field | Rule |
| --- | --- |
| kind | Required, `purchase` or `sale`. Not a field on the form — it is which tab the trade was recorded from ([§7.2](07-investments.md#72-purchases), [§7.3](07-investments.md#73-sales)) — and it is **locked once the trade exists**: a purchase edited into a sale would restate a position rather than correct a typo, and deleting the row and recording it again is the honest way to do that. |
| accountId | Required. The picker lists **brokerage accounts only**, closed ones included and marked ([§4.3](04-accounts.md#43-creating-and-editing)). |
| securityId | Required — chosen from the existing list or created inline ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)). |
| date | Required, date picker. **Not in the future**, exactly as for a transaction and for the same two reasons — a trade is a confirmation of something that happened, and a position dated ahead would put the net worth chart below the headline it ends at ([§11.5](11-calculations.md#115-net-worth-over-time)). No bound against the *account's* dates — check 12 reports those. |
| quantity | Required, > 0, at most 4 decimals. Direction is `kind`, never a negative quantity. |
| unitPrice | Required, > 0, at most 4 decimals. |
| fees | Amount field, required, ≥ 0. |
| taxes | Amount field, required on a sale, ≥ 0. **Forced to 0 and disabled on a purchase.** Never pre-filled from the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation). |
| oversell | **Not validated.** A sale of more than has been bought is saved and reported by checks 8 and 9. It is an anomaly, not a stage of ordinary work — but it is a rule about how two records relate, and those are reported, never refused ([§13.1](#131-how-it-behaves), [§9](09-checks.md)). Refusing it would also mean a form that can be blocked by a record the user has not reached yet, on the one screen where trades are entered in whatever order the confirmations came out of the envelope. |

### Security

| Field | Rule |
| --- | --- |
| isin | Required, unique, 12 characters, two letters then nine alphanumerics then a digit. The format is checked; the check digit is not recomputed. |
| ticker, name | Required, trimmed. |
| type | Required, one of the five of [§2](02-domain-model.md). Freely editable afterwards — it groups the portfolio breakdown ([§3.1](03-portfolio.md#31-behaviour)) and nothing is derived from it, so correcting one restates a slice and no recorded figure. |
| currency | Required. `EUR` only in v1 ([§13.1](#131-how-it-behaves)). **It need not match the currency of the account the security is held in**: both are EUR in v1, and the day a second currency exists an instrument quoted in one and settled through an account in another is an ordinary arrangement, not an error to have designed a refusal for. |
| taxRate | Required. **Entered and shown as a percentage**, 0 – 100 with at most 1 decimal, and stored as the fraction it names — 12,5 is typed and `0,125` is kept ([§11](11-calculations.md)). |
| delete | Refused while any **trade** points at it. Prices are not dependent data — they are part of the security, not references to it, and they go with it. Deleting a security therefore deletes its price history in the same breath, and the confirmation says how many records that is. |

### Price

| Field | Rule |
| --- | --- |
| date | Required. **Not in the future** — a price is a fact about a day that has happened. |
| value | Required, > 0, at most 4 decimals. |
| collision | **Never asked about.** Saving onto a day that already has a price replaces it, and moving a record onto an occupied day does the same ([§2](02-domain-model.md), [§7.4](07-investments.md#74-securities)). One price per security per day is the model, the last word on a day wins, and a confirmation would ask about it every week — most often when a fetch replaces a value it wrote itself an hour earlier. **The editor shows the value the day currently holds while it is open**, so the replacement is visible before it happens rather than queried after. |

### Contract

| Field | Rule |
| --- | --- |
| name | Required, trimmed, unique. |
| monthsPerYear | Required, integer, 1 – 24. |
| hoursPerDay | Required, > 0, ≤ 24, at most 2 decimals. |
| startDate / endDate | Start required; end optional and ≥ start. |
| delete | Refused while any payslip points at it. Its ContractYear records go with it when it is deleted. |

### ContractYear

| Field | Rule |
| --- | --- |
| workingDays | Integer 1 – 366, **or empty**. Empty is a legitimate state meaning “not entered yet”, and is what makes the hourly columns read *undefined* rather than wrong ([§11.7](11-calculations.md#117-salary-figures)). Zero is refused — it is not a year, it is a division by zero spelled differently. |
| the record | **Created by typing into the cell and deleted by emptying it** ([§8.1](08-salaries.md#81-payslips)). Emptying returns the year to exactly the state it had before anything was typed, so there is no second reading in which the record survives holding nothing. It is the one delete that is **not confirmed**: nothing is lost but the number in the cell, it is in front of the user as they clear it, and typing it again is the whole of the undo ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Payslip

| Field | Rule |
| --- | --- |
| contractId | Required. |
| year, month | Required; month 1 – 12. The month must fall **within the contract's start and end dates** — a payslip from before you were hired is always a typo. |
| label | Optional, trimmed. It is what distinguishes a second payslip in a month from the first and what orders the two ([§8.1](08-salaries.md#81-payslips)), so it is not required — the ordinary monthly payslip is the one that has none — and not unique: nothing reads it but the eye. |
| gross, contractGross | Amount fields, required, > 0. |
| netPayment | Amount field, required, ≥ 0. |
| refunds, carPayment, pensionContribution | Amount fields, required, ≥ 0. These are magnitudes; the formula of [§11.7](11-calculations.md#117-salary-figures) applies their signs. |

### Rule

| Field | Rule |
| --- | --- |
| substring | Required, trimmed, at least 2 characters. A one-character rule would match most of the file on its first commit, and re-categorisation is immediate ([§6.2](06-categories.md#62-rules)). |
| categoryId | Required, and a real category — *Automatic* is not offered, since a rule that assigns nothing is not a rule. |
| duplicates | A substring already used by an earlier rule is **allowed but flagged** on the row itself, and again in the apply summary, where it accounts for nothing: the later rule can never fire, and saying so is more useful than refusing it ([§6.2](06-categories.md#62-rules)). |
| the draft | Nothing in a rule editing session reaches the file until *Apply changes* is confirmed, and a draft that cannot be applied — a rule with no substring, or none with a category — marks the offending row and disables the button, exactly as any other form does ([§6.2](06-categories.md#62-rules)). |

### Preferences

| Field | Rule |
| --- | --- |
| priceStalenessDays, pensionRevaluationMonths, receiptPendingMonths | Integer ≥ 1. |
| transferMatchWindowDays, tradeMatchWindowDays | Integer 0 – 31. Zero means same day only. |
| backupCount | Integer 1 – 100. |
| defaultTaxRate | 0 – 100, at most 1 decimal, entered as a percentage and stored as a fraction, exactly as `Security.taxRate` above. |
| dateFormat, decimalSeparator, currencyPosition | Pickers over the closed sets of [§10](10-settings.md). There is nothing to reject: the only values offered are the legal ones. |
| thousandsSeparator | The same, plus **none**, which is a value rather than an empty field. |
| currencySymbol | Required, trimmed, 1 – 3 characters. The one free-text preference; empty is refused, since every figure in the application carries it ([§10](10-settings.md)). |
| separators | Decimal and thousands separators must differ; choosing the decimal separator's character as the thousands one is refused in place, leaving the previous value in force. **None** never collides. |

### Bulk import

| Field | Rule |
| --- | --- |
| account | Required before anything can be imported. |
| selection | *Import* is disabled while no account is chosen or nothing is ticked, and by nothing else. An unreadable row can never be ticked; **every other row is freely selectable**, a flagged duplicate included — the flag unselects it, it does not lock it ([§5.7](05-transactions.md#57-bulk-import)). |

---

[← §12 Storage](12-storage.md) · [§14 Empty and error states →](14-empty-and-error-states.md)
