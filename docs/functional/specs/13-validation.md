# §13 — Validation

*[Index](../README.md) · no mockups for this section*

What the forms refuse. Everything here is enforced at the point of entry, by the field or by the
save; nothing here is a check ([§9](09-checks.md)). The division is deliberate: a **rule about one
record in isolation** is a validation and is prevented, while a **rule about how two records
relate** is a check and is reported. That is why a trade cannot have a negative quantity but can
sell more than was ever bought.

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
- **An imported row is validated exactly as a typed one.** Bulk import is another way into the same
  record, not a side door around these rules: a pasted row whose date does not parse, whose amount
  does not parse, or whose description is empty after trimming **cannot be read**, is marked with
  the reason and cannot be ticked ([§5.7](05-transactions.md#57-bulk-import)). **There is no value
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
- **The file is not re-validated on open.** These rules exist to stop a person mistyping, not to
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
| openingDate | Required. |
| closingDate | Optional; must be ≥ `openingDate`. Nothing else is required to close an account — check 11 reports what was left in it ([§9](09-checks.md)). |
| delete | Refused while any transaction or trade points at it. Closing is what retiring looks like ([§4.3](04-accounts.md#43-creating-and-editing)). |

### Transaction

| Field | Rule |
| --- | --- |
| accountId | Required. The picker lists **cash accounts only**; a brokerage account can never be chosen, here or on an import. **Closed accounts are listed**, marked and after the open ones ([§4.3](04-accounts.md#43-creating-and-editing)). |
| date | Required, date picker. No bound against the account's dates — check 12 reports those. |
| description | Required, trimmed, non-empty. It is the only thing a rule matches on. |
| amount | Amount field, required, either sign. **Zero is legal** — a card verification, a reversed charge and a fee waived to nothing all post as `0,00`, and refusing them would send the user to invent a figure the bank did not use. Empty still blocks the save: zero is a value that was typed, empty is a field that was not. |
| categoryId | **Either a category or *Automatic* — never nothing.** The picker offers no clearing entry, so a `manual` row always carries a category and the only empty category in the file is one no rule matched ([§2](02-domain-model.md)). |
| receiptState | One of the three values, `na` on creation, changed only by hand ([§6.3](06-categories.md#63-category-list)). |

### Trade

| Field | Rule |
| --- | --- |
| accountId | Required. The picker lists **brokerage accounts only**, closed ones included and marked ([§4.3](04-accounts.md#43-creating-and-editing)). |
| securityId | Required — chosen from the existing list or created inline ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)). |
| quantity | Required, > 0, at most 4 decimals. Direction is `kind`, never a negative quantity. |
| unitPrice | Required, > 0, at most 4 decimals. |
| fees | Amount field, required, ≥ 0. |
| taxes | Amount field, required on a sale, ≥ 0. **Forced to 0 and disabled on a purchase.** Never pre-filled from the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation). |
| oversell | **Not validated.** A sale of more than has been bought is saved and reported by checks 8 and 9 — during entry, a sale recorded before its purchase is the ordinary case ([§9](09-checks.md)). |

### Security

| Field | Rule |
| --- | --- |
| isin | Required, unique, 12 characters, two letters then nine alphanumerics then a digit. The format is checked; the check digit is not recomputed. |
| ticker, name | Required, trimmed. |
| currency | Required. `EUR` only in v1 ([§13.1](#131-how-it-behaves)). |
| taxRate | Required, 0 – 100, at most 1 decimal. |
| delete | Refused while any **trade** points at it. Prices are not dependent data — they are part of the security, not references to it, and they go with it. Deleting a security therefore deletes its price history in the same breath, and the confirmation says how many records that is. |

### Price

| Field | Rule |
| --- | --- |
| date | Required. **Not in the future** — a price is a fact about a day that has happened. |
| value | Required, > 0, at most 4 decimals. |
| collision | Saving onto a day that already has a price **asks first**, naming the value being replaced. Moving a record onto an occupied day does the same ([§7.4](07-investments.md#74-securities)). |

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

### Payslip

| Field | Rule |
| --- | --- |
| contractId | Required. |
| year, month | Required; month 1 – 12. The month must fall **within the contract's start and end dates** — a payslip from before you were hired is always a typo. |
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
| defaultTaxRate | 0 – 100, at most 1 decimal. |
| dateFormat, decimalSeparator, currencyPosition | Pickers over the closed sets of [§10](10-settings.md). There is nothing to reject: the only values offered are the legal ones. |
| thousandsSeparator | The same, plus **none**, which is a value rather than an empty field. |
| currencySymbol | Required, trimmed, 1 – 3 characters. The one free-text preference; empty is refused, since every figure in the application carries it ([§10](10-settings.md)). |
| separators | Decimal and thousands separators must differ; choosing the decimal separator's character as the thousands one is refused in place, leaving the previous value in force. **None** never collides. |

### Bulk import

| Field | Rule |
| --- | --- |
| account | Required before anything can be imported. |
| selection | *Import* is disabled only while nothing is ticked. An unreadable row can never be ticked; **every other row is freely selectable**, a flagged duplicate included — the flag unselects it, it does not lock it ([§5.7](05-transactions.md#57-bulk-import)). |

---

[← §12 Storage](12-storage.md) · [§14 Empty and error states →](14-empty-and-error-states.md)
