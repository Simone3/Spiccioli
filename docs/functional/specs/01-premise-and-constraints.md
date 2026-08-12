# §1 — Premise and constraints

*[Index](../README.md) · no mockups for this section*

---

- **One user, one file.** No accounts, no server, no sync logic of its own. The file may sit in any
  folder — including one a cloud client is syncing — and the application neither knows nor cares
  which ([§12](12-storage.md)). What it does not do is **coordinate two of itself**: there is no
  locking, no merge and no live collaboration, so two machines editing the same synced file at once
  is a situation it detects and reports rather than one it resolves ([§12](12-storage.md)).
- **A desktop application on macOS, Windows and Linux.** All three are first-class: the same build
  behaves identically on each, and no *behaviour* may depend on a platform-specific path, filesystem
  behaviour or system service. Two things are platform-shaped and neither is behaviour: where
  preferences are kept, which is each platform's own application-data location
  ([§10](10-settings.md)), and where the menu bar is drawn
  ([§12.2](12-storage.md#122-the-menu-bar-and-which-file-is-open)). The user is never asked about
  either. No mobile, no web deployment ([§15](15-out-of-scope.md)).
- **Nothing leaves the machine** except security identifiers sent to a price provider, and only in
  the moment the user presses *Update prices* ([§7.6](07-investments.md#76-prices)).
- **Euro only, and currency is not a concept the application has.** Every amount is EUR, no record
  carries a currency field, no form asks for one and no preference sets a symbol: figures are printed
  with `€` because that is what they are ([§11](11-calculations.md)). There are no exchange rates and
  no conversion, and there is nothing that could be set to another currency and then be wrong. A
  second currency is a future version's problem and it will be a real one — a field on accounts and
  securities, a rate table, and a decision at every total about what is being added to what
  ([§15](15-out-of-scope.md)). Recording a currency now, on the strength of that, would have been
  one value with one possible setting, present on two forms and read by nothing, and it would not
  have made the day easier when it comes.
- **English only.** The interface ships in one language and there is no language selector. Nothing
  user-facing may be hard-coded in a way that would make a second language a rewrite: strings stay
  separable from the code, and dates and decimal separators already come from preferences rather than
  a system locale ([§10](10-settings.md)).
- **Dark theme only.**
- **The application replaces a spreadsheet** holding ten years of history. Data entry speed and the
  ability to spot a mistake matter more than features.
- **Derived data is never stored.** Balances, holdings, averages, totals and pairings are recomputed
  from records every time they are shown, never persisted. Plenty of figures are still entered by
  hand — opening balances, prices, payslip lines, working days, sell fees — but none of them is
  something the application could have calculated for itself. **One value is computed and then
  written down, deliberately:** the category a rule assigns to a transaction is stored on the
  transaction and held in step with the rule list at all times, so that every total can read it
  instead of re-deriving it ([§2](02-domain-model.md)). It is the exception, and it is the only one.

> **The organising principle.** Two independent sources of truth are kept deliberately unlinked —
> bank transactions come from account exports, trades and payslips are entered by hand — and the
> application's job is to tell you when they disagree. That is why nothing is auto-generated from
> anything else, and why [§9](09-checks.md) exists.

---

[§2 Domain model →](02-domain-model.md)
