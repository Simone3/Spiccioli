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
- **Euro only.** Currency is recorded on accounts and securities but every computation assumes EUR.
  No exchange rates, no conversion.
- **English only.** The interface ships in one language and there is no language selector. Nothing
  user-facing may be hard-coded in a way that would make a second language a rewrite: strings stay
  separable from the code, and dates, decimal separators and currency already come from preferences
  rather than a system locale ([§10](10-settings.md)).
- **Dark theme only.**
- **The application replaces a spreadsheet** holding ten years of history. Data entry speed and the
  ability to spot a mistake matter more than features.
- **Derived data is never stored.** Balances, holdings, averages, totals and pairings are recomputed
  from records every time they are shown, never persisted. Plenty of figures are still entered by
  hand — opening balances, prices, payslip lines, working days, sell fees — but none of them is
  something the application could have calculated for itself.

> **The organising principle.** Two independent sources of truth are kept deliberately unlinked —
> bank transactions come from account exports, trades and payslips are entered by hand — and the
> application's job is to tell you when they disagree. That is why nothing is auto-generated from
> anything else, and why [§9](09-checks.md) exists.

---

[§2 Domain model →](02-domain-model.md)
