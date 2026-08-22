# §4 — Accounts

*[Index](../README.md) · [why it is this way](../why/04-accounts.md)*

Two tabs: Accounts, Institutions. The spine of the file — transactions, balances and net worth all hang off an account, so it sits second in the sidebar and everything else refers back to it.

> **How an account is written, everywhere in the application.** *Institution · Account* — *Fineco · Conto Corrente*, never *Fineco* and never *Conto Corrente* on its own. Both halves earn their place: two banks may each hold a *Conto Corrente* and the name rules permit it ([§13](13-validation.md)), so the institution is what tells them apart, while which account of a bank's several a record sits on is what the matching of [§11.6](11-calculations.md#116-derived-matching) turns on. The order is the institution first, which is also the order the accounts table sorts in ([§4.1](#41-accounts)).
>
> **A `Cash` account is written with its name alone** — *Wallet*, with no separator and nothing standing in for the bank. It has no institution to name ([§2](02-domain-model.md)), and the em dash of [§4.1](#41-accounts) is a table column that cannot be filled rather than a piece of the name that is missing.
>
> **The exception is a screen that gives the institution a field or a column of its own, and there are three**: the accounts table ([§4.1](#41-accounts)), the Portfolio breakdown by account ([§3.1](03-portfolio.md#31-behaviour)) and the account form ([§4.3](#43-creating-and-editing)). There the account is named on its own and the institution is beside it. Everywhere else — every other table, every picker, the *Matched* column ([§5.1](05-transactions.md#51-columns)) and the records a failing check names ([§9](09-checks.md)) — an account is one string in two halves.

---

## 4.1 Accounts

- Every account ever opened, closed ones dimmed and last. The columns are the stored fields of [§2](02-domain-model.md) — name, institution, type, opening balance, exit tax, opening date, closing date and notes, which is **all of them but `id`**, and no screen anywhere shows one of those ([§2](02-domain-model.md)) — plus a **transaction count** and a **trade count**.
- **Together those two columns are what says whether a row can be deleted**: a cash account is blocked by its transactions, a `Brokerage` one by its trades ([§13](13-validation.md)).
- **No balance column.** Balances are what the Portfolio screen is for ([§3](03-portfolio.md)).
- **Five columns are em-dashed on the types that cannot carry them**, and the form is what enforces each ([§13](13-validation.md), [§2](02-domain-model.md)): a `Brokerage` account shows one for opening balance and for transactions, every cash account shows one for trades, **every type but `Pension fund` shows one for exit tax**, and **a `Cash` account shows one for institution** — the em dash there is a field that cannot be filled rather than one nobody got round to.
- **Exit tax** is the rate a pension fund's payout would be taxed at, shown as a percentage. It is the only stored field on this table that changes a figure without recording anything: it moves the account's balance, and therefore net worth, on the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation) and nowhere else.
- Ordered by **institution name**, then opening date, then account name. **Accounts belonging to no institution come first** — which is to say the `Cash` accounts, those being the only ones that can ([§2](02-domain-model.md)); **closed accounts sort last regardless**, after everything open.

## 4.2 Institutions

- An institution exists to **group accounts** and to **carry a sell fee**. It has no balance, no history and no screen of its own.
- **Institutions are created, edited and deleted here**, with the *Add institution* button above the list and the row menu on each line. This is the only place: the account form picks from what already exists and cannot create one ([§4.3](#43-creating-and-editing)).
- The list carries the name, the **default sell fee**, an **Accounts** count and **notes** — the stored fields of [§2](02-domain-model.md) but `id`, plus the count, which is the same rule the accounts table follows ([§4.1](#41-accounts)). The count is the accounts pointing at it, open and closed alike, and it is what says whether an institution can be deleted — at zero it can, otherwise it cannot.
- **Default sell fee** is the flat fee [§11.3](11-calculations.md#113-hypothetical-liquidation) charges once per holding when estimating what a position would leave you with. It is not a fee anyone was charged — real fees sit on each trade ([§7.2](07-investments.md#72-purchases), [§7.3](07-investments.md#73-sales)). An institution that never sells anything is given a zero: the field is required and empty is not a value ([§13](13-validation.md)). Nothing supplies a zero on an institution's behalf, and nothing needs to: every account that can hold a security has an institution behind it ([§11.3](11-calculations.md#113-hypothetical-liquidation)).
- An institution is **never retired**. It has no closing date and no status: when its last account closes it simply stops appearing anywhere that matters, and it stays in this list because the closed account still points at it ([§4.3](#43-creating-and-editing)).
- The list is ordered **by name**; there is no other order and no filter.

## 4.3 Creating and editing

Both forms live on the Accounts screen, and **each tab creates what it lists**: *Add account* on the Accounts tab, *Add institution* on the Institutions tab. They are two independent forms and neither opens the other.

- **Default sell fee** is a flat amount, used only for the “if sold today” figures of [§11.3](11-calculations.md#113-hypothetical-liquidation) and therefore for net worth itself ([§3.1](03-portfolio.md#31-behaviour)). Fees actually charged are recorded on each trade. Type a zero to see gross figures — the field is required and has no empty state ([§13](13-validation.md)).
- **Institution** offers the institutions already recorded and nothing else — no *None* entry and no *New institution…* entry ([§4.2](#42-institutions)). **It is required on seven of the eight types and disabled on the eighth**: a `Cash` account is physical cash, which is held by nobody, so the field greys out and shows *None* ([§13](13-validation.md)) — a disabled state rather than an entry anyone can pick. **Switching the type is what moves it**: choosing `Cash` clears the field and disables it, choosing anything else re-enables it empty and marks it until an institution is picked. This is the one field on the form whose *state* the type changes rather than its value; the other is exit tax, which the type adds and removes outright.
- **Opening balance** is the balance on the opening date, before any recorded transaction. Leave it at zero when the account’s full history is being imported; a *Brokerage* account has none, its value being entirely its holdings.
- **Exit tax** appears only when the type is `Pension fund`, and disappears again if the type is changed away from it ([§13](13-validation.md)). It is entered as a percentage and **pre-filled with 15,0%**, the Italian rate before any reduction for years of participation. There is no preference behind it: unlike a security's rate ([§10](10-settings.md)), this is a field filled in once or twice in a working life. **It affects the estimate of [§11.3](11-calculations.md#113-hypothetical-liquidation) and nothing that was ever recorded** — the same terms a security's tax rate is on ([§7.4](07-investments.md#74-securities)). Correct it by hand when the fund's own statement says the rate has moved.
- **Closing date** is how an account is retired: fill it in and the account is marked closed and sorted last everywhere, keeping its history. **Closing is the only retirement mechanism there is.** The form does not require the account to be empty first — check 11 reports a closed account that still holds something, and check 12 the records dated outside the two dates. Both name the situation; neither refuses the edit ([§9](09-checks.md)).
- **Closing changes no total.** A closed account keeps its balance in net worth, in the breakdown and in the report ([§11.4](11-calculations.md#114-balances-and-net-worth)).
- **A closed account stays in every picker**, marked as closed and sorted after the open ones.
- Contracts are created the same way, on the Salaries screen, with the fields listed in [§2](02-domain-model.md): name, months per year, hours per day, start and end date, notes. Securities are created either inline while recording a purchase ([§7.5](07-investments.md#75-recording-a-trade-and-where-securities-come-from)) or on the Securities tab on Investments, which is also where they are corrected and their prices kept ([§7.4](07-investments.md#74-securities)).

---

[← §3 Portfolio](03-portfolio.md) · [§5 Transactions →](05-transactions.md)
