# §4 — Accounts

*[Index](../README.md) · [mockups for this section](../mockups/04-accounts.html)*

Two tabs: Accounts, Institutions. The spine of the file — transactions, balances and net worth all
hang off an account, so it sits second in the sidebar and everything else refers back to it.

---

## In brief

- **Accounts tab** lists every account ever opened, closed ones dimmed and last. Its columns are the
  stored fields of [§2](02-domain-model.md) plus a **transaction count** and a **trade count**, which
  together say whether a row can be deleted. **No balance column** — that is Portfolio's job.
- Ordered by **institution name, then opening date, then account name**; accounts with no institution
  first; **closed accounts last regardless**.
- **Institutions tab** is where institutions are created, edited and deleted — the only place. It
  lists name, **default sell fee** and an account count, ordered by name, with no filter.
- **Closing an account** is the only retirement mechanism there is. It marks the account and sorts it
  last; it changes no total ([§11.4](11-calculations.md#114-balances-and-net-worth)), and the form
  does not require the account to be empty first.
- A **closed account stays in every picker**, marked and last, because its rows stay editable.
- **An institution is required on every account type but `Liquidity`**; opening balance is forced to
  0 on `Brokerage`; the default sell fee is required and may be zero
  ([§13](13-validation.md)).
- **Nothing with dependents can be deleted**, and every delete confirms — except the two named in
  [§4.3](#43-creating-and-editing).

---

## 4.1 Accounts

> **Mockup —** [Accounts tab](../mockups/04-accounts.html#accounts)

- Every account ever opened, closed ones dimmed and last. The columns are the stored fields of
  [§2](02-domain-model.md) plus a **transaction count** and a **trade count**. They are also the
  quickest way to spot **one real account recorded twice**, which the name rules narrow but cannot
  prevent: two accounts at one bank cannot share a name ([§13](13-validation.md)), so what this
  actually looks like is *Conto Corrente* beside *Conto corrente 2*, or the same bank entered as two
  institutions with one account under each. The counts are what give it away — one row carrying ten
  years and its twin carrying the handful of rows that belong to it — and the fix is to move those
  rows by editing them and delete the emptied account, which the delete rule then allows.
- **Together those two columns are what says whether a row can be deleted**, and they have to be
  two because the account types hold different things: a cash account is blocked by its
  transactions, a `Brokerage` one by its trades ([§13](13-validation.md)). One count would have left
  brokerage accounts with a column that never explains why the delete is refused.
- **No balance column.** Balances are what the Portfolio screen is for ([§3](03-portfolio.md)), and
  a figure that appears twice is a figure that can disagree with itself.
- A `Brokerage` account shows an em dash for opening balance and for transactions, and every cash
  account shows one for trades: neither can hold what the other does ([§2](02-domain-model.md)). The
  form enforces it ([§13](13-validation.md)).
- Ordered by **institution name**, then opening date, then account name — the last only to break the
  tie when a bank's accounts were all opened on the same day, so the order is total and the table
  never rearranges itself between two openings. **Accounts belonging to no institution come first**:
  there is exactly one of them in practice, physical cash, and a row with an em dash where every
  other row has a bank reads as a heading rather than as a gap when it sits at the top. **Closed
  accounts sort last regardless**, after everything open.

## 4.2 Institutions

> **Mockup —** [Institutions tab](../mockups/04-accounts.html#institutions)

- An institution exists to **group accounts** and to **carry a sell fee**. It has no balance, no
  history and no screen of its own — which is why it is the tab behind accounts rather than beside
  them.
- **Institutions are created, edited and deleted here**, with the *Add institution* button above the
  list and the row menu on each line. This is the only place: the account form picks from what
  already exists and cannot create one ([§4.3](#43-creating-and-editing)).
- **Accounts** counts the accounts pointing at it, open and closed alike, and is the column that
  says whether an institution can be deleted: at zero it can, otherwise it cannot.
- **Default sell fee** is the flat fee [§11.3](11-calculations.md#113-hypothetical-liquidation)
  charges once per holding when estimating what a position would leave you with. It is not a fee
  anyone was charged — real fees sit on each trade ([§7.2](07-investments.md#72-purchases),
  [§7.3](07-investments.md#73-sales)). An institution that never sells anything is given a zero: the
  field is required and empty is not a value, so a fee of nothing is a fee that was typed
  ([§13](13-validation.md)). Nothing supplies a zero on an institution's behalf, and nothing needs
  to: every account that can hold a security has an institution behind it
  ([§11.3](11-calculations.md#113-hypothetical-liquidation)).
- An institution is **never retired**. It has no closing date and no status: when its last account
  closes it simply stops appearing anywhere that matters, and it stays in this list because the
  closed account still points at it ([§4.3](#43-creating-and-editing)).
- The list is ordered **by name**; there is no other order and no filter. A list this short — one
  row per bank the user has ever held an account with — does not need one, and a name is what you
  look an institution up by.

## 4.3 Creating and editing

Both forms live on the Accounts screen, and **each tab creates what it lists**: *Add account* on the
Accounts tab, *Add institution* on the Institutions tab. They are two independent forms and neither
opens the other. An institution is entered once and lasts for years, so the account form picks from
the institutions that already exist rather than growing a way to create one mid-form — a form that
can open a second form has to hold the first one's half-finished state while it does, which is a
great deal of machinery for a keystroke saved twice a decade. Add the bank first, then the account.

> **Mockup —** [Add account · add institution](../mockups/04-accounts.html#forms)

- **Default sell fee** is a flat amount, used only for the “if sold today” figures of
  [§11.3](11-calculations.md#113-hypothetical-liquidation) and therefore for net worth itself
  ([§3.1](03-portfolio.md#31-behaviour)). Fees actually charged are recorded on each trade. Type a
  zero to see gross figures — the field is required and has no empty state
  ([§13](13-validation.md)).
- **Institution** offers the institutions already recorded, and *None* — but *None* only while the
  type is `Liquidity`. **Every other type requires one** ([§13](13-validation.md)): a deposit, a
  term deposit, a pension fund and a voucher balance are all held by somebody, and a `Brokerage`
  account without an institution could never pair a trade against the money that paid for it, since
  that pairing is the institution the two accounts share
  ([§11.6](11-calculations.md#116-derived-matching)). The one account that legitimately belongs to
  no one is physical cash, and physical cash is `Liquidity`. There is no *New institution…* entry
  ([§4.2](#42-institutions)).
- **Opening balance** is the balance on the opening date, before any recorded transaction. Leave it
  at zero when the account’s full history is being imported; a *Brokerage* account has none, its
  value being entirely its holdings.
- **Closing date** is how an account is retired: fill it in and the account is marked closed and
  sorted last everywhere, keeping its history. The form does not require the account to be empty
  first — check 11 reports a closed account that still holds something, and check 12 the records
  dated outside the two dates. Both name the situation; neither refuses the edit
  ([§9](09-checks.md)).
- **Closing changes no total.** A closed account keeps its balance in net worth, in the breakdown and
  in the report ([§11.4](11-calculations.md#114-balances-and-net-worth)), because an account that was
  closed properly was emptied first and contributes zero of its own accord, and one that was not is
  holding money the file still says you have. Dropping it out of the arithmetic instead would move
  net worth on the day a date was typed into a form — a figure changing because of an edit that
  recorded nothing about the money. Check 11 is what says an account was closed with something left
  in it, and it says it without the total having to lie in the meantime.
- **A closed account stays in every picker**, marked as closed and sorted after the open ones.
  Closing marks an account; it does not say the account has become
  unmentionable. Its rows still have to be editable — a miscategorised payment from 2019 is found
  long after the account it sat on was shut — and a row can only be edited if its own account is
  among the choices. It is also the only way check 12's second half is reachable by hand: a record
  dated after the closing date has to be enterable before it can be reported.
- Contracts are created the same way, on the Salaries screen, with the fields listed in
  [§2](02-domain-model.md): name, months per year, hours per day, start and end date, notes.
  Securities are created either inline while recording a purchase
  ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)) or on the
  Securities tab on Investments, which is also where they are corrected and their prices kept
  ([§7.4](07-investments.md#74-securities)).

> **Deletion rule, wherever reference data is edited.** A record with dependent data cannot be
> deleted; deletion stays available only while nothing points at it. Every delete asks for
> confirmation: there is no undo.
>
> **Two deletions are confirmed somewhere other than at the click, and they are the only two.**
> Clearing a year's `workingDays` cell deletes its ContractYear record and is **not** confirmed at
> all — nothing is lost but the number in the cell, which is in front of the user as they clear it,
> and typing it again is the whole of the undo ([§13](13-validation.md)). Deleting a **rule** is
> confirmed once, later, as part of *Apply changes*: a rule removed from a draft has changed nothing
> in the file yet, and the apply summary states how many transactions the deletion un-categorises
> before anything is written ([§6.2](06-categories.md#62-rules)). Everywhere else the confirmation is
> the click itself.
>
> **Only accounts can be retired**, and retiring one marks it rather than removing it: setting an
> account's `closingDate` keeps its history, keeps its balance in every total
> ([§11.4](11-calculations.md#114-balances-and-net-worth)) and keeps it in the pickers, where it
> stays marked and last, because its rows remain editable. There is no equivalent for institutions,
> securities, contracts or rules — a contract has an `endDate` that says when it ended, and
> everything else stays in the list. One retirement mechanism, on the one entity anyone would think
> to retire, beats a status flag on everything.

---

[← §3 Portfolio](03-portfolio.md) · [§5 Transactions →](05-transactions.md)
