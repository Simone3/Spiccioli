# §4 — Accounts

*[Index](../README.md) · [mockups for this section](../mockups/04-accounts.html)*

Two tabs: Accounts, Institutions. The spine of the file — transactions, balances and net worth all hang off an account, so it sits second in the sidebar and everything else refers back to it.

---

## 4.1 Accounts

> **Mockup —** [Accounts tab](../mockups/04-accounts.html#accounts)

- Every account ever opened, closed ones dimmed and last. The columns are the stored fields of [§2](02-domain-model.md) — name, institution, type, opening balance, exit tax, opening date, closing date and notes, which is **all of them but `id`**, and no screen anywhere shows one of those ([§2](02-domain-model.md)) — plus a **transaction count** and a **trade count**.
- **Together those two columns are what says whether a row can be deleted**: a cash account is blocked by its transactions, a `Brokerage` one by its trades ([§13](13-validation.md)).
- **No balance column.** Balances are what the Portfolio screen is for ([§3](03-portfolio.md)).
- **Four columns are em-dashed on the types that cannot carry them**, and the form is what enforces each ([§13](13-validation.md), [§2](02-domain-model.md)): a `Brokerage` account shows one for opening balance and for transactions, every cash account shows one for trades, and **every type but `Pension fund` shows one for exit tax**.
- **Exit tax** is the rate a pension fund's payout would be taxed at, shown as a percentage. It is the only stored field on this table that changes a figure without recording anything: it moves the account's balance, and therefore net worth, on the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation) and nowhere else.
- Ordered by **institution name**, then opening date, then account name. **Accounts belonging to no institution come first**; **closed accounts sort last regardless**, after everything open.

## 4.2 Institutions

> **Mockup —** [Institutions tab](../mockups/04-accounts.html#institutions)

- An institution exists to **group accounts** and to **carry a sell fee**. It has no balance, no history and no screen of its own.
- **Institutions are created, edited and deleted here**, with the *Add institution* button above the list and the row menu on each line. This is the only place: the account form picks from what already exists and cannot create one ([§4.3](#43-creating-and-editing)).
- The list carries the name, the **default sell fee**, an **Accounts** count and **notes** — the stored fields of [§2](02-domain-model.md) but `id`, plus the count, which is the same rule the accounts table follows ([§4.1](#41-accounts)). The count is the accounts pointing at it, open and closed alike, and it is what says whether an institution can be deleted — at zero it can, otherwise it cannot.
- **Default sell fee** is the flat fee [§11.3](11-calculations.md#113-hypothetical-liquidation) charges once per holding when estimating what a position would leave you with. It is not a fee anyone was charged — real fees sit on each trade ([§7.2](07-investments.md#72-purchases), [§7.3](07-investments.md#73-sales)). An institution that never sells anything is given a zero: the field is required and empty is not a value ([§13](13-validation.md)). Nothing supplies a zero on an institution's behalf, and nothing needs to: every account that can hold a security has an institution behind it ([§11.3](11-calculations.md#113-hypothetical-liquidation)).
- An institution is **never retired**. It has no closing date and no status: when its last account closes it simply stops appearing anywhere that matters, and it stays in this list because the closed account still points at it ([§4.3](#43-creating-and-editing)).
- The list is ordered **by name**; there is no other order and no filter.

## 4.3 Creating and editing

Both forms live on the Accounts screen, and **each tab creates what it lists**: *Add account* on the Accounts tab, *Add institution* on the Institutions tab. They are two independent forms and neither opens the other.

> **Mockup —** [Add account · add institution](../mockups/04-accounts.html#forms)

- **Default sell fee** is a flat amount, used only for the “if sold today” figures of [§11.3](11-calculations.md#113-hypothetical-liquidation) and therefore for net worth itself ([§3.1](03-portfolio.md#31-behaviour)). Fees actually charged are recorded on each trade. Type a zero to see gross figures — the field is required and has no empty state ([§13](13-validation.md)).
- **Institution** offers the institutions already recorded, and *None* — but *None* only while the type is `Liquidity`. **Every other type requires one** ([§13](13-validation.md)). The one account that legitimately belongs to no one is physical cash, and physical cash is `Liquidity`. There is no *New institution…* entry ([§4.2](#42-institutions)).
- **Opening balance** is the balance on the opening date, before any recorded transaction. Leave it at zero when the account’s full history is being imported; a *Brokerage* account has none, its value being entirely its holdings.
- **Exit tax** appears only when the type is `Pension fund`, and disappears again if the type is changed away from it ([§13](13-validation.md)). It is entered as a percentage and **pre-filled with 15,0%**, the Italian rate before any reduction for years of participation. There is no preference behind it: unlike a security's rate ([§10](10-settings.md)), this is a field filled in once or twice in a working life. **It affects the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation) and nothing that was ever recorded** — the same terms a security's tax rate is on ([§7.4](07-investments.md#74-securities)). Correct it by hand when the fund's own statement says the rate has moved.
- **Closing date** is how an account is retired: fill it in and the account is marked closed and sorted last everywhere, keeping its history. **Closing is the only retirement mechanism there is.** The form does not require the account to be empty first — check 11 reports a closed account that still holds something, and check 12 the records dated outside the two dates. Both name the situation; neither refuses the edit ([§9](09-checks.md)).
- **Closing changes no total.** A closed account keeps its balance in net worth, in the breakdown and in the report ([§11.4](11-calculations.md#114-balances-and-net-worth)).
- **A closed account stays in every picker**, marked as closed and sorted after the open ones.
- Contracts are created the same way, on the Salaries screen, with the fields listed in [§2](02-domain-model.md): name, months per year, hours per day, start and end date, notes. Securities are created either inline while recording a purchase ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)) or on the Securities tab on Investments, which is also where they are corrected and their prices kept ([§7.4](07-investments.md#74-securities)).

> **Deletion rule, wherever reference data is edited.** A record with dependent data cannot be deleted; deletion stays available only while nothing points at it. Every delete asks for confirmation: there is no undo.
>
> **Two deletions are not confirmed at the click, and they are the only two.** Clearing a year's `workingDays` cell deletes its ContractYear record and is **not confirmed at all** ([§13](13-validation.md)) — nothing is lost but the number in the cell, and typing it again is the whole of the undo. Deleting a **rule** *is* confirmed, but later: a rule removed from a draft has changed nothing in the file yet, so the confirmation comes with *Apply changes*, whose summary states how many transactions the deletion un-categorises before anything is written ([§6.2](06-categories.md#62-rules)). Everywhere else the confirmation is the click itself.
>
> **Replacing a price is not a third exception, and it is the case that looks like one.** A day holds one price ([§2](02-domain-model.md)), so saving onto a day that already has one — or moving a record onto an occupied day — overwrites what was there with no prompt ([§7.4](07-investments.md#74-securities), [§13](13-validation.md)). That is a replacement rather than a deletion: the value that goes is one the model never allowed to stand beside the value replacing it, and what stands in for the confirmation is **visibility** — the inline editor shows the figure it is about to overwrite while the new one is typed, and a fetch shows every figure the pass would overwrite, once, before writing any of it ([§7.6](07-investments.md#76-prices)). **The one place a price is genuinely deleted is the history on the Securities tab, and that is confirmed like every other delete** ([§7.4](07-investments.md#74-securities)).
>
> **Only accounts can be retired**, and retiring one marks it rather than removing it: setting an account's `closingDate` keeps its history, keeps its balance in every total ([§11.4](11-calculations.md#114-balances-and-net-worth)) and keeps it in the pickers, where it stays marked and last. There is no equivalent for institutions, securities, contracts or rules — a contract has an `endDate` that says when it ended, and everything else stays in the list.

---

## Why it is this way

- **The transaction and trade counts are two columns rather than one** because the account types hold different things, and a single count would have left brokerage accounts with a column that never explains why the delete is refused. The two are also the quickest way to spot **one real account recorded twice**, which the name rules narrow but cannot prevent: two accounts at one bank cannot share a name ([§13](13-validation.md)), so what this actually looks like is *Conto Corrente* beside *Conto corrente 2*, or the same bank entered as two institutions with one account under each. One row carrying ten years and its twin carrying a handful of rows is what gives it away, and the fix is to move those rows by editing them and delete the emptied account, which the delete rule then allows.
- **There is no balance column** because a figure that appears twice is a figure that can disagree with itself.
- **The exit tax rate is on the account rather than in the preferences** because there is one or perhaps two pension funds in a working life, and a preference exists to stop a value being retyped. It sits on this table rather than only on the form for the same reason every other stored field does: this is the screen that says what an account *is*, and a rate that moves net worth ought not to be visible only while a form is open.
- **Account name breaks the ordering tie** only so the order is total and the table never rearranges itself between two openings when a bank's accounts were all opened on the same day. **Accounts with no institution come first** because there is exactly one of them in practice, physical cash, and a row with an em dash where every other row has a bank reads as a heading rather than as a gap when it sits at the top.
- **Institutions are the tab behind accounts rather than a screen of their own** because an institution has no balance and no history to show.
- **The institution list needs no filter and no second order.** It is one row per bank the user has ever held an account with, and a name is what you look an institution up by.
- **The account form cannot create an institution** because an institution is entered once and lasts for years. A form that can open a second form has to hold the first one's half-finished state while it does, which is a great deal of machinery for a keystroke saved twice a decade. Add the bank first, then the account.
- **Closing changes no total** because an account that was closed properly was emptied first and contributes zero of its own accord, and one that was not is holding money the file still says you have. Dropping it out of the arithmetic instead would move net worth on the day a date was typed into a form — a figure changing because of an edit that recorded nothing about the money. Check 11 is what says an account was closed with something left in it, and it says it without the total having to lie in the meantime.
- **A closed account stays in the pickers** because closing marks an account; it does not say the account has become unmentionable. Its rows still have to be editable — a miscategorised payment from 2019 is found long after the account it sat on was shut — and a row can only be edited if its own account is among the choices. It is also the only way check 12's second half is reachable by hand: a record dated after the closing date has to be enterable before it can be reported.
- **One retirement mechanism, on the one entity anyone would think to retire, beats a status flag on everything.**

---

[← §3 Portfolio](03-portfolio.md) · [§5 Transactions →](05-transactions.md)
