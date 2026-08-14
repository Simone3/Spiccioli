# §10 — Settings

*[Index](../README.md) · [why it is this way](../why/10-settings.md) · [mockups for this section](../mockups/10-settings.html)*

Preferences, and nothing else. Every kind of reference data lives on the screen that consumes it — accounts and institutions on Accounts ([§4](04-accounts.md)), securities and prices on Investments ([§7.4](07-investments.md#74-securities)), contracts on Salaries ([§8.2](08-salaries.md#82-contracts)), rules and the category list on Categories ([§6.2](06-categories.md#62-rules), [§6.3](06-categories.md#63-category-list)). What is left here belongs to no screen in particular.

> **Mockup —** [Settings screen](../mockups/10-settings.html#settings)

---

**Every preference is a closed set or a bounded number.** There is **no free-text setting at all**, and nothing here can be given a value the application then has to interpret. Nothing here sets a currency either: every figure is EUR and is printed with `€` ([§1](01-premise-and-constraints.md), [§11](11-calculations.md)).

| Setting | Values | Default | Used by |
| --- | --- | --- | --- |
| dateFormat | `DD/MM/YYYY` · `MM/DD/YYYY` · `YYYY-MM-DD` | `DD/MM/YYYY` | Display, the date picker included; the opening value of the import's date control ([§5.7](05-transactions.md#57-bulk-import)) |
| decimalSeparator | `,` · `.` | `,` | Display; **the one decimal character the amount field accepts** ([§13](13-validation.md)); the opening value of the import's decimal control |
| thousandsSeparator | `.` · `,` · space · **none** | `.` | Display; the opening value of the import's thousands control. Never typeable in a form. |
| defaultTaxRate | 0 – 100%, one decimal | 26% | Initial value of `Security.taxRate` ([§2](02-domain-model.md)). Entered as a percentage, **stored as the fraction it names** — 26% is `0,26` ([§11](11-calculations.md)). Changing it does not touch securities that already exist. |
| priceStalenessDays | integer ≥ 1 | 30 | Check 3; the *Last priced* highlight on Holdings ([§7.1](07-investments.md#71-holdings)) |
| pensionRevaluationMonths | integer ≥ 1 | 3 | Check 10 |
| receiptPendingMonths | integer ≥ 1 | 3 | Check 14 |
| transferMatchWindowDays | integer 0 – 31 | 5 | [§11.6](11-calculations.md#116-derived-matching), check 1 |
| tradeMatchWindowDays | integer 0 – 31 | 5 | [§11.6](11-calculations.md#116-derived-matching), checks 6 and 7 |
| backupCount | integer 1 – 100 | 10 | [§12](12-storage.md) |

**The three date formats are the three that are unambiguous to write down**, one per order, and the separator inside them is part of the format rather than a choice of its own. **The thousands separator may be none**, which prints `21900,00`; the decimal separator may not be ([§11](11-calculations.md)). The two must differ ([§13](13-validation.md)).

Formats are a **user preference, not a hard-coded locale**. Changing one re-renders every figure in the application immediately.

**The three format preferences do one other job: they say where the import's own controls start.** The bulk-import screen carries a date-format, a decimal-separator and a thousands-separator control of its own, over these same closed sets, each opening at the value the preference holds and each changeable for that paste alone ([§5.7](05-transactions.md#57-bulk-import)). Changing one there writes nothing here and is remembered nowhere. **Nothing about a paste is inferred from its contents**, and nothing here is ever applied to a paste behind the user's back: what reads the rows is a control on screen, showing what it is doing.

**Nothing the user types is parsed either.** Every date in the application is entered through a date picker and every amount through a validated numeric field that accepts one shape and refuses the rest as it is typed, so no form holds free text needing interpretation. **`decimalSeparator` does reach one form control**: it names the single decimal character the amount field will accept, the other one being untypeable there and a thousands separator being untypeable anywhere ([§13](13-validation.md)). That is a keyboard decision, not an interpretation — the field still admits one shape and refuses the rest, and changing the preference changes which key produces the decimal point, never what a figure already entered was taken to mean. The only text the application parses is a pasted bank export, and it is parsed to the three controls the import screen puts beside it.

- **Preferences are global, and are not stored in the data file.** They live with the application, in the platform's own application-data location, together with the list of recently opened files ([§12](12-storage.md)) — so they survive switching files, apply to every file opened afterwards, and do not travel with a ledger that is copied or sent to someone else. **The screen says so in a line at the top.**
- **No save button.** A preference applies as it is changed and is written to that store immediately; a value that cannot be applied is refused in place and the previous one stays in force ([§13](13-validation.md)). **Nothing here ever marks the data file as modified.**
- The two **path** rows are read-only facts about the session: where the open file is, and where its backups are. This is where you come to find out *where* the open file is; **File › Open…** in the menu bar ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)) is how you open a different one.

---

[← §9 Checks](09-checks.md) · [§11 Calculations →](11-calculations.md)
