# §4 — Accounts — why it is this way

*[Index](../README.md) · [the specification](../specs/04-accounts.md)*

---

- **The transaction and trade counts are two columns rather than one** because the account types hold different things, and a single count would have left brokerage accounts with a column that never explains why the delete is refused. The two are also the quickest way to spot **one real account recorded twice**, which the name rules narrow but cannot prevent: two accounts at one bank cannot share a name ([§13](../specs/13-validation.md)), so what this actually looks like is *Conto Corrente* beside *Conto corrente 2*, or the same bank entered as two institutions with one account under each. One row carrying ten years and its twin carrying a handful of rows is what gives it away, and the fix is to move those rows by editing them and delete the emptied account, which the delete rule then allows.
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
