# §1 — Premise and constraints

*[Index](../README.md) · no mockups for this section*

---

- **One user, one file.** No accounts, no server, no sync logic of its own. The file may sit in any
  folder — including one a cloud client is syncing — and the application neither knows nor cares
  which ([§12](12-storage.md)). It does not **coordinate two of itself**: there is no locking, no
  merge and no live collaboration. Two machines editing the same synced file at once is a situation
  it **detects, reports, and settles the only way one file allows** — the session in front of the
  user wins, the version found on disk is copied into the backup folder before it is overwritten, and
  the user is told in plain words where that copy went ([§12](12-storage.md)). That is last writer
  wins with the loser kept, and it is deliberately not a merge, not a repair and not a choice put to
  someone who can only see one of the two versions.
- **A desktop application on macOS, Windows and Linux.** All three are first-class: the same build
  behaves identically on each, and no *behaviour* depends on a platform-specific path, filesystem
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
  no conversion. A second currency is a future version's problem
  ([§15](15-out-of-scope.md)).
- **English only.** The interface ships in one language and there is no language selector. Nothing
  user-facing is hard-coded in a way that would make a second language a rewrite: strings stay
  separable from the code, and dates and decimal separators come from preferences rather than
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
- **Two independent sources of truth are kept deliberately unlinked** — bank transactions come from
  account exports, trades and payslips are entered by hand — and the application's job is to tell you
  when they disagree. **Nothing is auto-generated from anything else** ([§9](09-checks.md)).

---

## Why it is this way

- **The organising principle** is the unlinked pair of sources. Because neither side is generated
  from the other, a disagreement between them is real evidence rather than a bookkeeping artefact,
  and reporting those disagreements is what [§9](09-checks.md) exists to do.
- **Currency is left out rather than recorded against the future.** A second currency will be a real
  piece of work when it comes — a field on accounts and securities, a rate table, and a decision at
  every total about what is being added to what — and recording a currency now, on the strength of
  that, would have been one value with one possible setting, present on two forms and read by
  nothing. It would not have made that day any easier. Because nothing records a currency, there is
  nothing that could be set to another one and then be wrong.
- **The platform-shaped exceptions are kept to two** so that “the same build behaves identically on
  each” stays a statement that can be checked. Preferences have to live somewhere the platform
  dictates, and the menu bar has to be drawn where the platform draws it; neither changes what the
  application does, which is why neither is put to the user as a question.
- **The one stored derived value earns its exception** by being read constantly: holding a
  rule-assigned category in step with the rule list lets every total read the stored value instead of
  re-deriving it behind each figure ([§2](02-domain-model.md)).

---

[§2 Domain model →](02-domain-model.md)
