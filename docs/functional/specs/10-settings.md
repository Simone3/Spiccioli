# §10 — Settings

*[Index](../README.md) · [mockups for this section](../mockups/10-settings.html)*

Preferences, and nothing else. Every kind of reference data lives on the screen that consumes it —
accounts and institutions on Accounts ([§4](04-accounts.md)), securities and prices on Investments
([§7.4](07-investments.md#74-securities)), contracts on Salaries
([§8.2](08-salaries.md#82-contracts)), rules and the category list on Categories
([§6.2](06-categories.md#62-rules), [§6.3](06-categories.md#63-category-list)) — so that editing a
thing and seeing what it does are the same trip. What is left here belongs to no screen in
particular.

> **Mockup —** [Settings screen](../mockups/10-settings.html#settings)

---

| Setting | Default | Used by |
| --- | --- | --- |
| dateFormat | DD/MM/YYYY | Display only |
| decimalSeparator | , | Display only |
| thousandsSeparator | . | Display only |
| currencySymbol | € | Every monetary figure — **all of them carry it** |
| currencyPosition | before | As above |
| defaultTaxRate | 26% | Initial value of `Security.taxRate` ([§2](02-domain-model.md)). Changing it does not touch securities that already exist. |
| priceStalenessDays | 30 | Check 3, holdings marker |
| pensionRevaluationMonths | 3 | Check 10 |
| receiptPendingMonths | 3 | Check 14 |
| transferMatchWindowDays | 5 | [§11.6](11-calculations.md#116-derived-matching), check 1 |
| tradeMatchWindowDays | 5 | [§11.6](11-calculations.md#116-derived-matching), checks 6 and 7 |
| backupCount | 10 | [§12](12-storage.md) |

Formats are a **user preference, not a hard-coded locale**. Changing one re-renders every figure in
the application immediately.

**They are display-only, and importing ignores them.** A pasted export is parsed by detecting its
own date order and separators from the rows themselves
([§5.7](05-transactions.md#57-bulk-import)), because the file came from a bank and has no reason to
match how you like to read numbers. The two are kept apart deliberately: changing how dates are
displayed must never change how a paste is interpreted.

**Nothing the user types is parsed either.** Every date in the application is entered through a date
picker and every amount through a validated numeric field that accepts one shape and refuses the
rest as it is typed — so no form holds free text needing interpretation, and these preferences have
no second job anywhere. The only text the application parses is a pasted bank export, which carries
its own formats. Display, entry and import are three separate things, and only one of them involves
guessing.

- **Preferences are global, and are not stored in the data file.** They live with the application,
  in the platform's own application-data location, together with the list of recently opened files
  ([§12](12-storage.md)) — so they survive switching files, apply to every file opened afterwards,
  and do not travel with a ledger that is copied or sent to someone else. The screen says so in a
  line at the top, because a settings screen inside a file-based application is otherwise assumed to
  be part of the file.
- **That is a deliberate trade and it points one way.** Formats and thresholds describe the person
  reading, not the money recorded: the same user wants the same date order in every file they open,
  and the alternative — preferences inside each file — means opening a second ledger silently
  repaints the first one's conventions and two files can disagree about how to print a date. The
  cost is that a file handed to someone else arrives with their formats, not yours, which is the
  correct outcome for everything on this screen.
- **No save button.** A preference applies as it is changed and is written to that store
  immediately; a value that cannot be applied is refused in place and the previous one stays in
  force ([§13](13-validation.md)). Nothing here ever marks the data file as modified.
- The two **path** rows are read-only facts about the session, shown because the window title
  carries only the file's name and the backup folder is otherwise invisible. This is where you come
  to find out *where* the open file is; **File › Open…** in the menu bar
  ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)) is how you open a different one.

---

[← §9 Checks](09-checks.md) · [§11 Calculations →](11-calculations.md)
